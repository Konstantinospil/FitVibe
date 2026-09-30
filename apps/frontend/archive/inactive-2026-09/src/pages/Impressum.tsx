import React from "react";
import { useTranslation } from "react-i18next";
import PageIntro from "../components/PageIntro";
import PublicReturnButton from "../components/PublicReturnButton";
import { Card, CardContent } from "../components/ui";

const contentStyle: React.CSSProperties = {
  maxWidth: "900px",
  margin: "0 auto",
  padding: "var(--space-xl)",
  lineHeight: 1.8,
  color: "var(--color-text-primary)",
  fontSize: "var(--font-size-md)",
};

const Impressum: React.FC = () => {
  const { t } = useTranslation();

  return (
    <PageIntro
      title={t("impressum.title")}
      description={t("impressum.description")}
      actions={<PublicReturnButton />}
    >
      <Card
        style={{
          maxWidth: "900px",
          width: "100%",
          margin: "0 auto",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <CardContent style={contentStyle}>
          <p className="section-text">{t("impressum.content")}</p>
        </CardContent>
      </Card>
    </PageIntro>
  );
};

export default Impressum;
