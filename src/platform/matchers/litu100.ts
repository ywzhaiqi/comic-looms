import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { Chapter } from "../../page-fetcher";
import { ADAPTER } from "../adapt";
import { BaseMatcher, Result, OriginMeta } from "../platform";

/**
 * litu100.xyz 站点适配器
 * 用于从 litu100.xyz 网站获取漫画图片信息
 */
class Litu100Matcher extends BaseMatcher<Document> {
  meta?: GalleryMeta;

  /**
   * 获取章节列表
   * @returns 章节列表的异步生成器
   */
  async *fetchChapters(): AsyncGenerator<Chapter[]> {
    const ret: Chapter[] = [];
    
    // 获取封面图片 - 使用更通用的选择器
    const coverImg = document.querySelector<HTMLImageElement>(".cover img, .comic-cover img, .thumbnail img");
    const coverSrc = coverImg?.src;
    
    // 获取所有章节链接 - 使用更通用的选择器
    const chapterLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".chapters a, .chapter-list a, .episode-list a"));
    
    if (chapterLinks.length > 0) {
      // 如果有多个章节，为每个章节创建 Chapter 对象
      chapterLinks.forEach((ch, i) => {
        const title = ch.textContent?.trim() || `第${i + 1}话`;
        const href = ch.href;
        ret.push(new Chapter(i, title, href, coverSrc));
      });
    } else {
      // 如果没有找到章节，尝试使用"开始阅读"按钮 - 使用更通用的选择器
      const readButton = document.querySelector<HTMLAnchorElement>(".read-btn, .start-read a, .read-now a");
      if (readButton) {
        ret.push(new Chapter(0, "Default", readButton.href, coverSrc));
      } else {
        throw new Error("无法找到章节或阅读按钮");
      }
    }
    
    return ret;
  }

  /**
   * 获取页面源
   * @param chapter 章节信息
   * @returns 页面源的异步生成器
   */
  async *fetchPagesSource(chapter: Chapter): AsyncGenerator<Result<Document>> {
    // 获取章节页面内容
    const response = await window.fetch(chapter.source);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    yield Result.ok(doc);
    
    // 检查是否有下一页
    let nextPage = doc.querySelector<HTMLAnchorElement>(".page-next")?.href;
    while (nextPage) {
      const nextResponse = await window.fetch(nextPage);
      const nextHtml = await nextResponse.text();
      const nextDoc = new DOMParser().parseFromString(nextHtml, "text/html");
      yield Result.ok(nextDoc);
      
      // 获取下一页链接
      nextPage = nextDoc.querySelector<HTMLAnchorElement>(".page-next")?.href;
    }
  }

  /**
   * 解析图片节点
   * @param pageSource 页面源
   * @param _chapterID 章节ID
   * @returns 图片节点列表
   */
  async parseImgNodes(pageSource: Document, _chapterID?: number): Promise<ImageNode[]> {
    const list: ImageNode[] = [];
    
    // 查找页面中的图片元素 - 使用多种可能的选择器
    const imgElements = Array.from(pageSource.querySelectorAll<HTMLImageElement>(
      ".comic-images img"
    ));
    
    for (const element of imgElements) {
      // 优先使用 data-src，其次使用 src
      const src = element.getAttribute('data-src') || element.src;
      if (!src) continue;
      
      // 获取图片标题，如果没有则使用URL的最后一部分
      const title = element.alt || src.split("/").pop() || `image_${list.length + 1}`;
      
      // 创建图片节点
      list.push(new ImageNode("", src, title, undefined, src));
    }
    
    return list;
  }

  /**
   * 获取原始图片元数据
   * @param node 图片节点
   * @param _retry 是否重试
   * @param _chapterID 章节ID
   * @returns 原始图片元数据
   */
  async fetchOriginMeta(node: ImageNode, _retry: boolean, _chapterID?: number): Promise<OriginMeta> {
    // 如果已经设置了原始图片URL，直接返回
    if (node.originSrc) {
      return { url: node.originSrc };
    }
    
    // 否则使用缩略图URL
    return { url: node.thumbnailSrc };
  }

  /**
   * 获取画廊元数据
   * @param _chapter 章节信息
   * @returns 画廊元数据
   */
  galleryMeta(_chapter: Chapter): GalleryMeta {
    if (this.meta) return this.meta;
    
    // 获取漫画标题 - 使用多种可能的选择器
    const title = document.querySelector(".comic-info .title, .comic-info-box .title, .manga-title, h1")?.textContent?.trim() || document.title || "未知标题";
    
    // 创建画廊元数据
    this.meta = new GalleryMeta(window.location.href, title);
    this.meta.originTitle = title;
    
    // 获取其他信息 - 使用多种可能的选择器
    const author = document.querySelector(".comic-info .author, .comic-info-box .author, .manga-author")?.textContent?.trim();
    const country = document.querySelector(".comic-info .country, .comic-info-box .country, .manga-country")?.textContent?.trim();
    const status = document.querySelector(".comic-info .status, .comic-info-box .status, .manga-status")?.textContent?.trim();
    
    // 添加到标签中
    const tags: Record<string, string[]> = {};
    if (author) tags["作者"] = [author.replace("作者：", "").replace("Author:", "").trim()];
    if (country) tags["地区"] = [country.replace("地区：", "").replace("Country:", "").trim()];
    if (status) tags["状态"] = [status.replace("状态：", "").replace("Status:", "").trim()];
    
    this.meta.tags = tags;
    
    return this.meta;
  }
}

// 注册适配器
ADAPTER.addSetup({
  name: "litu100",
  workURLs: [
    /litu100\.xyz\/comic\/id-.+/,
  ],
  match: ["https://litu100.xyz/*"],
  constructor: () => new Litu100Matcher(),
});