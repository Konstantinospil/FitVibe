import React from "react";

type AppSurfacePlaceholderProps = {
  title: string;
};

const AppSurfacePlaceholder: React.FC<AppSurfacePlaceholderProps> = ({ title }) => (
  <section aria-labelledby="surface-title" data-app-surface={title.toLowerCase()}>
    <h1 id="surface-title">{title}</h1>
  </section>
);

export default AppSurfacePlaceholder;
