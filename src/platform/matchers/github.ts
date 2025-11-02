import ImageNode from "../../img-node";
import { ADAPTER } from "../adapt";
import { BaseMatcher, OriginMeta, Result } from "../platform";

type GHImage = {
  name: string,
  url: string,
}

class GithubMatcher extends BaseMatcher<GHImage[]> {
  // async *fetchChapters(): AsyncGenerator<Chapter[]> {
  //   yield [new Chapter(1, "README", window.location.href)];
  // }
  async *fetchPagesSource(): AsyncGenerator<Result<GHImage[]>> {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>(".markdown-body img"));
    const ret = images.map((img, i) => {
      const src = img.src;
      if (!src) return undefined;
      const name = src.split("/").pop() ?? (i + 1) + ".jpg";
      return { name, url: src };
    }).filter(img => img !== undefined);
    yield Result.ok(ret);
  }
  async parseImgNodes(images: GHImage[]): Promise<ImageNode[]> {
    return images.map((img) => new ImageNode("", img.url, img.name, undefined, img.url));
  }
  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.originSrc! };
  }
}

ADAPTER.addSetup({
  match: ["github.com"],
  name: "Github",
  workURLs: [
    /github.com\/MapoMagpie\/comic-looms$/,
    // /github.com\/[\w_.-]+\/[\w_.-]+(\/.*\.md|)?$/,
    // /github.com\/[\w_.-]+\/[\w_.-]+\/wiki/,
  ],
  constructor: () => new GithubMatcher(),
});
