import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/profile", "/library", "/favorites", "/highlights", "/notes", "/chat", "/create-book"],
      },
    ],
    sitemap: "https://bookbyte.app/sitemap.xml",
  };
}
