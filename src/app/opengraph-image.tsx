import { ImageResponse } from "next/og";

export const alt = "FixMate - Book trusted repair and maintenance services";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background: "linear-gradient(135deg, #071427 0%, #0d1f36 55%, #12314f 100%)",
          color: "#f2f7fd",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#2fb8f5",
              color: "#04121f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            F
          </div>
          <div style={{ display: "flex" }}>FixMate</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: 920 }}>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: -1.5,
            }}
          >
            Book trusted repair and maintenance services
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              lineHeight: 1.35,
              color: "#b7c6da",
              maxWidth: 900,
            }}
          >
            Discover verified technicians for smartphones, laptops, and home appliances.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#8ed8fb",
          }}
        >
          <div style={{ display: "flex" }}>fixmate-client-neon.vercel.app</div>
          <div style={{ display: "flex" }}>Reliable repairs. Transparent booking.</div>
        </div>
      </div>
    ),
    size,
  );
}