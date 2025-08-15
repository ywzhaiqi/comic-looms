import ImageNode from "../../img-node";
import { Chapter } from "../../page-fetcher";
import { ADAPTER } from "../adapt";
import { BaseMatcher, OriginMeta, Result } from "../platform";

class MangaParkMatcher extends BaseMatcher<string> {

  async fetchChapters(): Promise<Chapter[]> {
    let list = Array.from(document.querySelectorAll<HTMLAnchorElement>("div[data-name='chapter-list'] .flex-col > .px-2 > .space-x-1 > a"));
    if (list.length === 0) {
      list = Array.from(document.querySelectorAll<HTMLAnchorElement>("div[data-name='chapter-list'] .flex-col-reverse > .px-2 > .space-x-1 > a"));
      list = list.reverse();
    }
    return list.map((elem, i) => new Chapter(i, elem.textContent ?? "Chapter" + (i + 1), elem.href));
  }

  async *fetchPagesSource(source: Chapter): AsyncGenerator<Result<string>> {
    yield Result.ok(source.source);
  }

  async parseImgNodes(href: string): Promise<ImageNode[]> {
    const doc = await window.fetch(href).then(resp => resp.text()).then(text => new DOMParser().parseFromString(text, "text/html")).catch(Error);
    if (doc instanceof Error) throw doc;
    const elements = Array.from(doc.querySelectorAll<HTMLDivElement>("div[data-name='image-item'] > div"));
    const digits = elements.length.toString().length;
    return elements.map((elem, i) => {
      const src = elem.querySelector<HTMLImageElement>("img")?.src;
      if (!src) throw new Error("cannot find image from chapter: " + href);
      const ext = src.split(".").pop() ?? "jpg";
      const title = (i + 1).toString().padStart(digits, "0") + "." + ext;
      const [w, h] = [parseInt(elem.style.width), parseInt(elem.style.height)];
      const node = new ImageNode("", href, title, undefined, src, { w, h });
      return node;
    });
  }

  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.originSrc! };
  }

}
ADAPTER.addSetup({
  name: "MangaPark",
  workURLs: [
    /mangapark.(net|com)\/title\/[^/]+$/
  ],
  match: ["https://mangapark.com/*"],
  constructor: () => new MangaParkMatcher(),
});
