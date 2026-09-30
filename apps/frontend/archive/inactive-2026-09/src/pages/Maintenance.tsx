import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui";
import logo from "../assets/logo_full_dark.png";
import maintenanceImage from "../assets/Maintenance.png";

type MaintenanceProps = {
  message?: string;
};

const eyebrowContainerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.6rem",
};

const eyebrowTextStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontWeight: 600,
  color: "var(--color-text-secondary)",
};

const accentLineStyle: React.CSSProperties = {
  width: "24px",
  height: "2px",
  background: "var(--color-accent)",
};

const Maintenance: React.FC<MaintenanceProps> = () => {
  return (
    <section
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(2rem, 8vw, 5rem) clamp(1rem, 4vw, 1.5rem)",
      }}
    >
      <Card
        as="article"
        style={{
          maxWidth: "920px",
          width: "100%",
          padding: "0",
          gap: "0",
        }}
      >
        <CardHeader
          style={{
            padding: "3rem clamp(1.5rem, 5vw, 3.5rem) 1.5rem",
            gap: "1rem",
            textAlign: "center",
            justifyItems: "center",
          }}
        >
          <span style={eyebrowContainerStyle}>
            <span style={accentLineStyle} aria-hidden="true" />
            <span style={eyebrowTextStyle}>Maintenance</span>
          </span>
          <CardTitle
            style={{
              fontSize: "clamp(2rem, 4vw, 2.8rem)",
              lineHeight: 1.15,
              letterSpacing: "-0.015em",
            }}
          >
            FitVibe is currently down for maintenance
          </CardTitle>
          <img
            src={logo}
            alt="FitVibe"
            style={{
              width: "clamp(140px, 30vw, 220px)",
              height: "auto",
            }}
          />
        </CardHeader>
        <CardContent
          style={{
            padding: "0 3rem 3rem",
            gap: "1.5rem",
            justifyItems: "center",
          }}
        >
          <img
            src={maintenanceImage}
            alt="Athlete building the fitvibe logo during maintenance"
            style={{
              width: "min(100%, 560px)",
              height: "auto",
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
};

export default Maintenance;
