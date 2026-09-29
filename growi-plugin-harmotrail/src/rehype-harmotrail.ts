type HastNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function classNames(node: HastNode): string[] {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/\s+/);
  return [];
}

function isHarmoTrailBlock(node: HastNode): boolean {
  if (node.type !== "element" || node.tagName !== "pre") return false;
  const code = node.children?.find(
    (child) => child.type === "element" && child.tagName === "code",
  );
  return code != null && classNames(code).includes("language-harmotrail");
}

function replaceBlocks(node: HastNode): void {
  if (!Array.isArray(node.children)) return;

  node.children.forEach((child) => {
    if (isHarmoTrailBlock(child)) {
      child.tagName = "harmotrail-app";
      child.properties = {
        className: ["harmotrail-growi-embed"],
        "data-harmotrail-plugin": "true",
      };
      child.children = [];
      return;
    }
    replaceBlocks(child);
  });
}

export function rehypeHarmoTrail() {
  return (tree: HastNode): void => replaceBlocks(tree);
}
