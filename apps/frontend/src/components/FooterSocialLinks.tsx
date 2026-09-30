import React from "react";
import { Github, Instagram, Linkedin, Youtube } from "lucide-react";
import { IconButton } from "@fitvibe/ui";
import { useTranslation } from "react-i18next";

type SocialPlatform = {
  key: "instagram" | "linkedin" | "youtube" | "github";
  label: string;
  href?: string;
  icon: React.ReactNode;
};

const socialPlatforms = (): SocialPlatform[] => [
  {
    key: "instagram",
    label: "Instagram",
    href: import.meta.env.VITE_SOCIAL_INSTAGRAM_URL,
    icon: <Instagram aria-hidden="true" />,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    href: import.meta.env.VITE_SOCIAL_LINKEDIN_URL,
    icon: <Linkedin aria-hidden="true" />,
  },
  {
    key: "youtube",
    label: "YouTube",
    href: import.meta.env.VITE_SOCIAL_YOUTUBE_URL,
    icon: <Youtube aria-hidden="true" />,
  },
  {
    key: "github",
    label: "GitHub",
    href: import.meta.env.VITE_SOCIAL_GITHUB_URL,
    icon: <Github aria-hidden="true" />,
  },
];

const FooterSocialLinks: React.FC = () => {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("footer.socialMediaLabel", { defaultValue: "Social media" })}
      data-component="footer-social-links"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-xs)",
        flexWrap: "wrap",
      }}
    >
      {socialPlatforms().map(({ key, label, href, icon }) => (
        <IconButton
          key={key}
          icon={icon}
          label={label}
          variant="ghost"
          size="lg"
          href={href}
          target={href ? "_blank" : undefined}
          rel={href ? "noopener noreferrer" : undefined}
          disabled={!href}
          data-social-platform={key}
        />
      ))}
    </nav>
  );
};

export default FooterSocialLinks;
