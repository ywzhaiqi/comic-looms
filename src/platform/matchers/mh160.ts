import ImageNode from "../../img-node";
import { Chapter } from "../../page-fetcher";
import { b64DecodeUnicode } from "../../utils/random";
import { ADAPTER } from "../adapt";
import { BaseMatcher, OriginMeta, Result } from "../platform";

class MH160Matcher extends BaseMatcher<string> {

  hosts: string[];
  constructor() {
    super();
    let hosts = ["xwdf.tgmhfc.uk", "mhreswhm.tgmhfc.uk", "qwe123.tgmhfc.uk", "resmhpic.tgmhfc.uk", "reszxc.tgmhfc.uk"];
    this.hosts = hosts.map(h => ({ h: "https://" + h, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(h => h.h);
  }

  title(): string {
    return document.querySelector(".Introduct .h1")?.textContent ?? document.title;
  }

  async *fetchChapters(): AsyncGenerator<Chapter[]> {
    const elements = Array.from(document.querySelectorAll<HTMLAnchorElement>("#chapterList_ul_1 > li > a"));
    yield elements.map((elem, i) => {
      return new Chapter(i, elem.textContent!, elem.href);
    });
  }

  async *fetchPagesSource(ch: Chapter): AsyncGenerator<Result<string>> {
    yield Result.ok(ch.source);
  }

  async parseImgNodes(source: string): Promise<ImageNode[]> {
    const raw = await window.fetch(source).then(resp => resp.text()).catch(Error);
    if (raw instanceof Error) throw raw;
    const data = raw.match(/var qTcms_S_m_murl_e=\"([^"]*?)\"/)?.[1];
    if (!data) throw new Error("no images url matched, regexp: var qTcms_S_m_murl_e=\\\"([^\"]*?)\\\"");
    const spID = raw.match(/var qTcms_S_p_id=\"([^"]*?)\"/)?.[1];
    if (!spID) throw new Error("no qTcms_S_p_id matched, regexp: var qTcms_S_p_id=\\\"([^\"]*?)\\\"");
    const imgPathRaw = b64DecodeUnicode(data);
    const imgPaths = imgPathRaw.split("$qingtiandy$");
    const digits = imgPaths.length.toString().length;
    return imgPaths.map((path, i) => {
      const title = path.split("/").pop() ?? ((i + 1).toString().padStart(digits, "0") + "." + "jpg");
      return new ImageNode("", source, title, undefined, this.getImgUrl(path, spID));
    });
  }
  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.originSrc! };
  }

  getImgUrl(path: string, spID: string): string {
    if (path.startsWith("/")) {
      const id = parseInt(spID || "0");
      if (id > 542724) {
        return this.hosts[0] + path;
      } else {
        return "https://mhpic6.tgmhfc.uk" + path;
      }
    } else {
      // if(qTcms_Pic_m_if!="2"){
      // // v = path;
      // 			v=v.replace(/\?/gi,"a1a1");
      // 			v=v.replace(/&/gi,"b1b1");
      // 			v=v.replace(/%/gi,"c1c1");	
      // 			var m_httpurl="";
      // 			if(typeof(qTcms_S_m_mhttpurl)!="undefined")m_httpurl=base64_decode(qTcms_S_m_mhttpurl);			
      // 			s=qTcms_m_indexurl+"statics/pic/?p="+escape(v)+"&wapif=1&picid="+qTcms_S_m_id+"&m_httpurl="+escape(m_httpurl);	
      // 		}    }
      throw new Error("还未支持此图片url解析: " + path);
    }
  }

  headers(): Record<string, string> {
    return {
      "Accept": "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
      "Referer": "https://m.mh160mh.com/",
    };
  }
}

ADAPTER.addSetup({
  name: "漫画160",
  workURLs: [
    /mh160mh.com\/kanmanhua\/\w+\/$/
  ],
  match: ["https://m.mh160mh.com/kanmanhua/*"],
  constructor: () => new MH160Matcher(),
});
