import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FixMate",
    short_name: "FixMate",
    description:
      "FixMate helps you discover and book verified technicians for smartphone, laptop, and home appliance repairs.",
    start_url: "/",
    display: "standalone",
    background_color: "#071427",
    theme_color: "#071427",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}