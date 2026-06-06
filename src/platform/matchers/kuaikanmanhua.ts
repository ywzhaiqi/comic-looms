import ImageNode from "../../img-node";
import { Chapter } from "../../page-fetcher";
import { ADAPTER } from "../adapt";
import { BaseMatcher, OriginMeta, Result } from "../platform";

type KuaiKanComic = {
  cover_image_url: string, // "https://f2.kkmh.com/image/250226/xlhzbNXQM.webp-w750.jpg"
  created_at: string, // "25-02-26"
  has_bought: boolean, // false
  id: number, // 774125
  is_free: boolean, // true
  is_pay_comic: boolean, // false
  is_vip_exclusive: boolean, // false
  likes_count: string, // "33166"
  locked: boolean, // false
  locked_code: number, // 200
  need_vip: boolean, // false
  title: string, // "第1话 完美人生系统"
  vip_exclusive_type: number, // -1
  vip_time_free_type: number, // 0
}

type KuaiKanComicImage = {
  baseHeight: number,
  baseWidth: number,
  height: number,
  url: string,
  width: number,
}

class KuaiKanMatcher extends BaseMatcher<string> {

  async *fetchChapters(): AsyncGenerator<Chapter[]> {
    // change a element z-index
    let ele = document.querySelector<HTMLElement>(".Headers");
    if (ele) ele.style.zIndex = "1000";
    // @ts-ignore
    let comics = window.__NUXT__?.data?.[0].comics as KuaiKanComic[];
    if (!comics || (comics.length ?? 0) === 0) {
      let sc = Array.from(document.querySelectorAll("script")).find(sc => sc.textContent.startsWith("window.__NUXT__"))?.textContent.replace("window.__NUXT__=", "");
      if (sc) {
        try {
          const data = new Function("return " + sc)();
          comics = data?.data?.[0].comics as KuaiKanComic[];
        } catch (err) {
          throw new Error("无法解析此漫画的章节信息")
        }
      }
    }
    if (!comics) throw new Error("无法找到此漫画的章节信息");
    const chapters = comics.map((c, i) => {
      return new Chapter(i, c.title, `${window.location.origin}/webs/comic-next/${c.id}`, c.cover_image_url);
    });
    yield chapters;
  }

  async *fetchPagesSource(ch: Chapter): AsyncGenerator<Result<string>> {
    yield Result.ok(ch.source);
  }

  async parseImgNodes(source: string): Promise<ImageNode[]> {
    const doc = await window.fetch(source).then(resp => resp.text())
      .then(text => new DOMParser().parseFromString(text, "text/html"))
      .catch(Error);
    if (doc instanceof Error) throw doc;
    let sc = Array.from(doc.querySelectorAll("script")).find(sc => sc.textContent.startsWith("window.__NUXT__"))?.textContent.replace("window.__NUXT__=", "");
    if (!sc) throw new Error("无法找到此章节的信息");
    let images: KuaiKanComicImage[] | undefined;
    try {
      const data = new Function("return " + sc)();
      images = data.data?.[0].comicInfo?.comicImages;
    } catch (err) {
      throw new Error("无法解析此章节的信息" + (err as Error).message);
    }
    if (!images || (images.length ?? 0) === 0) throw new Error("没有找到此章节的图片列表，可能是你没有购买，请点此确认: " + source);
    const digits = images.length.toString().length;
    return images.map((img, i) => {
      return new ImageNode("", img.url, (i + 1).toString().padStart(digits, "0"), undefined, img.url, { w: img.baseWidth, h: img.baseHeight });
    })
  }

  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.originSrc! };
  }

}

ADAPTER.addSetup({
  name: "快看漫画",
  match: [
    "kuaikanmanhua.com/*"
  ],
  workURLs: [
    /kuaikanmanhua.com\/web\/topic\/\d+\//,
  ],
  constructor: () => new KuaiKanMatcher(),
});
