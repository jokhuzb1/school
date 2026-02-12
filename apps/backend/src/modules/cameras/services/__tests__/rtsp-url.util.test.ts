import { describe, expect, test } from "vitest";
import { maskRtspUrl, parseRtspUrl } from "../rtsp-url.util";

describe("parseRtspUrl", () => {
  test("parses host/port/user/pass", () => {
    const parsed = parseRtspUrl("rtsp://user:pass@example.com:8554/stream");
    expect(parsed).toEqual({
      host: "example.com",
      port: 8554,
      username: "user",
      password: "pass",
    });
  });

  test("defaults port to 554", () => {
    const parsed = parseRtspUrl("rtsp://example.com/live");
    expect(parsed.host).toBe("example.com");
    expect(parsed.port).toBe(554);
  });

  test("rejects non-rtsp urls", () => {
    expect(() => parseRtspUrl("http://example.com")).toThrow(/Invalid RTSP URL/);
  });
});

describe("maskRtspUrl", () => {
  test("masks password when present", () => {
    expect(maskRtspUrl("rtsp://user:pass@host:554/x")).toBe(
      "rtsp://user:***@host:554/x",
    );
  });

  test("returns original string for unparseable urls", () => {
    expect(maskRtspUrl("not a url")).toBe("not a url");
  });
});

