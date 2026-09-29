import { describe, expect, it } from "vitest";
import { rehypeHarmoTrail } from "./rehype-harmotrail";

describe("rehypeHarmoTrail", () => {
  it("harmotrailコードブロックだけを埋め込み要素へ変換する", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: ["language-harmotrail"] },
              children: [{ type: "text", value: "" }],
            },
          ],
        },
        {
          type: "element",
          tagName: "pre",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "code",
              properties: { className: ["language-ts"] },
              children: [{ type: "text", value: "const a = 1" }],
            },
          ],
        },
      ],
    };

    rehypeHarmoTrail()(tree);

    expect(tree.children[0]).toMatchObject({
      tagName: "harmotrail-app",
      properties: { "data-harmotrail-plugin": "true" },
      children: [],
    });
    expect(tree.children[1].tagName).toBe("pre");
  });
});
