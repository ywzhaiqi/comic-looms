import { saveConf } from "./config";
import { Downloader } from "./download/downloader";
import EBUS from "./event-bus";
import { IMGFetcherQueue } from "./fetcher-queue";
import { IdleLoader } from "./idle-loader";
import { PageFetcher } from "./page-fetcher";
import { ADAPTER } from "./platform/adapt";
import { initEvents } from "./ui/event";
import { FullViewGridManager } from "./ui/full-view-grid-manager";
import { createHTML, addEventListeners, showMessage } from "./ui/html";
import type { Elements } from "./ui/html";
import { PageHelper } from "./ui/page-helper";
import { BigImageFrameManager } from "./ui/big-image-frame-manager";
import { Debouncer } from "./utils/debouncer";
import revertMonkeyPatch from "./utils/revert-monkey-patch";
import { sleep } from "./utils/sleep";
import { evLog } from "./utils/ev-log";
import { Filter } from "./filter";
import { ContextMenu } from "./ui/context-menu";
import { loadReadingRecord } from "./utils/reading-record";
import { i18n } from "./utils/i18n";
import type { ReadingRecord } from "./utils/reading-record";

/** 显示阅读记录提示框，提供"继续阅读"和"从头开始"选项 */
function showReadingRecordPrompt(HTML: Elements, BIFM: BigImageFrameManager, PF: PageFetcher, record: ReadingRecord) {
  const prompt = HTML.readingRecordPrompt;
  const text = HTML.readingRecordText;
  const continueBtn = HTML.readingRecordContinue;
  const fromStartBtn = HTML.readingRecordFromStart;

  // 设置提示文本
  const chapterDisplay = record.chapterIndex + 1;
  const pageDisplay = record.pageIndex + 1;
  text.textContent = i18n.lastReadPosition.get().replace("{{0}}", String(chapterDisplay)).replace("{{1}}", String(pageDisplay));

  // 设置按钮文本
  continueBtn.textContent = i18n.continueReading.get();
  fromStartBtn.textContent = i18n.readFromStart.get();

  // 显示提示框
  prompt.style.display = "block";

  const hidePrompt = () => { prompt.style.display = "none"; };

  /** 继续阅读：切换到记录的章节和页面 */
  const onContinue = () => {
    hidePrompt();
    // 收起章节选择面板
    HTML.chapters.panel.classList.add("p-collapse");
    HTML.chapters.panel.classList.remove("p-panel-large");
    HTML.chapters.panel.classList.remove("p-chapters-large");
    PF.changeToChapter(record.chapterIndex);
    // 等待章节加载后跳转到记录的页面
    const checkAndJump = () => {
      const chapter = PF.chapters[record.chapterIndex];
      if (chapter.filteredQueue.length > record.pageIndex) {
        const imf = chapter.filteredQueue[record.pageIndex];
        BIFM.show(imf);
      } else if (chapter.filteredQueue.length > 0) {
        BIFM.show(chapter.filteredQueue[0]);
      }
    };
    // 延迟等待章节加载
    sleep(500).then(checkAndJump);
  };

  /** 从头开始：不做任何跳转 */
  const onFromStart = () => {
    hidePrompt();
  };

  // 移除旧的事件监听器（通过克隆节点方式）
  const newContinueBtn = continueBtn.cloneNode(true) as HTMLElement;
  const newFromStartBtn = fromStartBtn.cloneNode(true) as HTMLElement;
  continueBtn.replaceWith(newContinueBtn);
  fromStartBtn.replaceWith(newFromStartBtn);

  newContinueBtn.addEventListener("click", onContinue);
  newFromStartBtn.addEventListener("click", onFromStart);

  // 更新引用
  (HTML as any).readingRecordContinue = newContinueBtn;
  (HTML as any).readingRecordFromStart = newFromStartBtn;
}

// Dynamically import the modules under ./platform/matchers, in which ADAPTER.addSetup will be executed
const modules = import.meta.glob('./platform/matchers/*.ts', { eager: true });
for (const path in modules) modules[path];


type DestoryFunc = () => Promise<void>;

function setup(): DestoryFunc {
  const MATCHER = ADAPTER.matcher!.constructor();
  const FL: Filter = new Filter();
  const HTML = createHTML(FL);
  [HTML.fullViewGrid, HTML.bigImageFrame].forEach(e => revertMonkeyPatch(e));

  const IFQ: IMGFetcherQueue = IMGFetcherQueue.newQueue();
  const IL: IdleLoader = new IdleLoader(IFQ);
  const PF: PageFetcher = new PageFetcher(IFQ, MATCHER, FL);
  const DL: Downloader = new Downloader(HTML, IFQ, IL, PF, MATCHER);

  // UI Manager
  const PH: PageHelper = new PageHelper(HTML, () => PF.chapters, () => DL.downloading);
  const BIFM: BigImageFrameManager = new BigImageFrameManager(HTML, (index) => PF.chapters[index], () => PF.chapters[0]?.source ?? "");
  const FVGM: FullViewGridManager = new FullViewGridManager(HTML, BIFM);

  const events = initEvents(HTML, BIFM, FVGM, IFQ, IL, PH);
  addEventListeners(events, HTML, BIFM, DL, PH);
  new ContextMenu(HTML, FVGM, events.appEvents);

  EBUS.subscribe("downloader-canvas-on-click", (index) => {
    IFQ.currIndex = index;
    if (IFQ.chapterIndex !== BIFM.chapterIndex) return;
    BIFM.show(IFQ[index]);
  });
  EBUS.subscribe("notify-message", (level, msg, duration) => showMessage(HTML.messageBox, level, msg, duration));

  PF.beforeInit = () => HTML.pageLoading.style.display = "flex";
  PF.afterInit = () => {
    HTML.pageLoading.style.display = "none";
    const idleThreads = ADAPTER.conf.maxIdleThreads;
    IL.processingIndexList = [];
    for (let i = 0; i < idleThreads && i < PF.queue.length; i++) {
      IL.processingIndexList.push(i);
    }
    evLog("info", `start idle fetch with ${idleThreads} threads, total queue length ${PF.queue.length}`);
    IL.start();
    if (ADAPTER.conf.autoEnterBig || BIFM.visible) {
      const imf = IFQ[BIFM.getPageNumber()];
      if (imf) BIFM.show(imf);
    }
  };

  // 章节列表加载后检查阅读记录并显示提示
  let readingRecordShown = false;
  EBUS.subscribe("pf-update-chapters", () => {
    if (readingRecordShown || !ADAPTER.conf.recordReading) return;
    const siteName = ADAPTER.matcher?.name;
    const galleryUrl = PF.chapters[0]?.source ?? "";
    if (!siteName || !galleryUrl) return;
    const record = loadReadingRecord(siteName, galleryUrl);
    if (record && record.chapterIndex < PF.chapters.length) {
      readingRecordShown = true;
      showReadingRecordPrompt(HTML, BIFM, PF, record);
    }
  });

  if (ADAPTER.conf.first) {
    events.showGuideEvent();
    ADAPTER.conf.first = false;
    saveConf({ first: false });
  }
  // 入口Entry
  EBUS.subscribe("start-download", (cb) => {
    signal.first = false;
    if (PF.chapters.length === 0) {
      EBUS.emit("pf-init", () => {
        DL.start();
        cb();
      });
    } else {
      DL.start();
      sleep(20).then(cb);
    }
  });
  const signal = { first: true };
  function entry(expand?: boolean) {
    if (HTML.pageHelper) {
      if (expand) {
        events.showFullViewGrid();
        if (signal.first) {
          signal.first = false;
          EBUS.emit("pf-init", () => { });
        }
      } else {
        ["config", "downloader"].forEach(id => events.togglePanelEvent(id, true));
        events.hiddenFullViewGrid();
      }
    }
  }
  EBUS.subscribe("toggle-main-view", entry);
  if (ADAPTER.conf.autoOpen) {
    HTML.entryBTN.setAttribute("data-stage", "open");
    entry(true);
  }

  return () => {
    console.log("destory eh-view-enhance");
    ADAPTER.reset();
    entry(false);
    PF.abort();
    IL.abort();
    IFQ.length = 0;
    EBUS.reset();
    document.querySelector("#ehvp-base")?.remove();
    return sleep(500);
  }
}

let destoryFunc: DestoryFunc | undefined;
const debouncer = new Debouncer();
function start() {
  debouncer.addEvent("LOCATION-CHANGE", () => {
    const newStart = () => {
      if (window.self !== window.top) {
        evLog("error", "in iframe");
        return;
      }
      if (document.querySelector(".ehvp-base")) return;
      ADAPTER.ready.then(() => {
        destoryFunc = setup()
      });
    };
    if (destoryFunc) {
      destoryFunc().then(newStart);
    } else {
      newStart();
    }
  }, 20);
}

let lastUrl = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = location.href;
    sleep(300).then(start);
  }
}).observe(document, { subtree: true, childList: true });
sleep(300).then(start);
