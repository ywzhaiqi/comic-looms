import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { Chapter } from "../../page-fetcher";
import { ADAPTER } from "../adapt";
import { BaseMatcher, OriginMeta, Result } from "../platform";

class YKMHMatcher extends BaseMatcher<string> {

  meta?: GalleryMeta;

  galleryMeta(): GalleryMeta {
    if (this.meta) return this.meta;
    const title = document.querySelector(".comic_deCon h1")?.textContent ?? document.title;
    this.meta = new GalleryMeta(window.location.href, title);
    return this.meta;
  }

  async *fetchChapters(): AsyncGenerator<Chapter[]> {
    const elements = Array.from(document.querySelectorAll<HTMLLIElement>("ul[id*=chapter-list] > li"));
    const ret = elements.map((elem) => {
      let title = elem.querySelector(".list_con_zj")?.textContent;
      const url = elem.querySelector("a")?.href;
      if (!title) title = elem.querySelector("a")?.textContent?.trim();
      return { title, url };
    }).filter(e => e.title && e.url).map((e, i) => new Chapter(i, e.title!, e.url!));
    yield ret;
  }

  async *fetchPagesSource(ch: Chapter): AsyncGenerator<Result<string>> {
    yield Result.ok(ch.source);
  }

  async parseImgNodes(source: string): Promise<ImageNode[]> {
    const raw = await window.fetch(source).then(resp => resp.text()).catch(Error);
    if (raw instanceof Error) throw raw;
    const imageUrls = raw.match(/var chapterImages = \[(.*?)\]/)?.[1];
    if (!imageUrls) throw new Error("no images url matched, regexp: var chapterImages = \\[(.*?)\\]");
    const urls = imageUrls.split(",").map(url => url.replaceAll("\"", "").trim());
    const digits = urls.length.toString().length;
    return urls.map((url, i) => {
      const ext = url.split(".").pop() ?? "jpg";
      const title = (i + 1).toString().padStart(digits, "0") + "." + ext;
      return new ImageNode("", source, title, undefined, url);
    });
  }

  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.originSrc! };
  }

}

ADAPTER.addSetup({
  name: "优酷漫画",
  workURLs: [
    /ykmh.net\/manhua\/\w+\/?$/,
  ],
  match: ["https://www.ykmh.net/manhua/*"],
  constructor: () => new YKMHMatcher(),
});
