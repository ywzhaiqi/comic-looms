import { saveConf } from "./config";
import { IMGFetcher } from "./img-fetcher";
import { ADAPTER } from "./platform/adapt";

export class Filter {
  values: FilterNode[] = [];
  allTags: Set<string> = new Set();
  onChange?: (filter: Filter) => void;
  constructor() {
    if (ADAPTER.conf.filterTags && ADAPTER.conf.filterTags.length > 0) {
      this.values = ADAPTER.conf.filterTags.map(FilterNode.fromString)
    }
  }
  filterNodes(imfs: IMGFetcher[], clearAllTags: boolean): IMGFetcher[] {
    if (!ADAPTER.conf.enableFilter) return imfs;
    let list = imfs;
    for (const val of this.values) {
      list = list.filter(imf => {
        for (const t of imf.node.tags) {
          if (val.tag.compare(t)) {
            return !val.exclude && true;
          }
        }
        return val.exclude;
      });
    }
    if (clearAllTags) {
      this.allTags.clear();
    }
    list.forEach(imf => imf.node.tags.forEach(tag => this.allTags.add(tag.toString())));
    return list;
  }
  push(raw: string) {
    const filterNode = FilterNode.fromString(raw);
    const exists = this.values.find(v => v.toString() === filterNode.toString());
    if (exists) return;
    this.values.push(filterNode);
    this.onChange?.(this);
    saveConf({ filterTags: this.values.map(Filter.toString) }, ADAPTER.matcher!.name);
  }
  remove(raw: string) {
    const index = this.values.findIndex(v => v.toString() === raw);
    if (index > -1) {
      this.values.splice(index, 1);
      this.onChange?.(this);
      saveConf({ filterTags: this.values.map(Filter.toString) }, ADAPTER.matcher!.name);
    }
  }
  clear() {
    this.values = [];
    this.onChange?.(this);
    saveConf({ filterTags: this.values.map(Filter.toString) }, ADAPTER.matcher!.name);
  }
}

export class FilterNode {
  exclude: boolean;
  tag: Tag;
  constructor(tag: Tag, exclude: boolean) {
    this.exclude = exclude;
    this.tag = tag;
  }
  toString(): string {
    return (this.exclude ? "!" : "") + this.tag.toString()
  }
  static fromString(raw: string): FilterNode {
    const exclude = raw.startsWith("!");
    const tagRaw = exclude ? raw.slice(1) : raw;
    const tag = new StringTag(tagRaw);
    return new FilterNode(tag, exclude);
  }
}

// export type TagCategory = "mime-type" | "misc" | "author" | "language" | string;
export interface Tag {
  compare(other: string): boolean;
  toString(): string;
}

export class StringTag implements Tag {
  value: string;

  constructor(value: string) {
    this.value = value;
  }
  compare(other: string): boolean {
    return this.value === other;
  }
  toString(): string {
    return this.value;
  }

}

