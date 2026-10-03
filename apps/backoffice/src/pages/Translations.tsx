import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { translationsApi, type Translation } from "../services/api";
import { Button } from "../components/ui/Button";
import { InputControl, SelectControl, TextareaControl } from "@fitvibe/ui";

const TranslationsPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [language, setLanguage] = useState<string>("");
  const [namespace, setNamespace] = useState<string>("");
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [showArchivedByKey, setShowArchivedByKey] = useState<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = useState<{ namespace: string; key_path: string } | null>(
    null,
  );
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newTranslation, setNewTranslation] = useState<{
    namespace: string;
    key_path: string;
    language: string;
    value: string;
  }>({
    namespace: "",
    key_path: "",
    language: "",
    value: "",
  });

  const queryClient = useQueryClient();
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["translations", search, keyPath, namespace],
    queryFn: async () => {
      const pageLimit = 500;
      const baseParams = {
        search: search || undefined,
        keyPath: keyPath || undefined,
        namespace: namespace || undefined,
        activeOnly: undefined, // only active translations in the list
        limit: pageLimit,
      };
      const firstPage = await translationsApi.list({ ...baseParams, offset: 0 });
      const allTranslations = [...firstPage.data];
      let offset = firstPage.pagination.limit;
      const total = firstPage.pagination.total;

      while (offset < total) {
        const nextPage = await translationsApi.list({ ...baseParams, offset });
        allTranslations.push(...nextPage.data);
        offset += nextPage.pagination.limit;
      }

      return {
        data: allTranslations,
        pagination: {
          total,
          limit: pageLimit,
          offset: 0,
        },
      };
    },
  });

  const { data: translationMetadata } = useQuery({
    queryKey: ["translations", "metadata"],
    queryFn: () => translationsApi.metadata(),
  });

  const { data: namespaceUpdates } = useQuery({
    queryKey: ["translations", "namespace-updates"],
    queryFn: () => translationsApi.namespaceUpdates(),
  });

  const languages = useMemo(() => translationMetadata?.data.languages ?? [], [translationMetadata]);
  const namespaces = useMemo(
    () => translationMetadata?.data.namespaces ?? [],
    [translationMetadata],
  );

  useEffect(() => {
    if (languages.length > 0 && !newTranslation.language) {
      setNewTranslation((prev) => ({ ...prev, language: languages[0] }));
    }
  }, [languages, newTranslation.language]);

  useEffect(() => {
    if (namespaces.length > 0 && !newTranslation.namespace) {
      setNewTranslation((prev) => ({ ...prev, namespace: namespaces[0] }));
    }
  }, [namespaces, newTranslation.namespace]);

  const latestUpdateByNamespace = useMemo(() => {
    const updates: Record<string, string | null> = {};
    namespaceUpdates?.data.forEach((item) => {
      updates[item.namespace] = item.updated_at;
    });
    return updates;
  }, [namespaceUpdates]);

  const namespacesForUpdates = useMemo(() => {
    if (namespaces.length > 0) {
      return namespaces;
    }
    return Object.keys(latestUpdateByNamespace);
  }, [latestUpdateByNamespace, namespaces]);

  const languageDisplayNames = useMemo(() => {
    if (typeof Intl !== "undefined" && "DisplayNames" in Intl) {
      return new Intl.DisplayNames(["en"], { type: "language" });
    }
    return null;
  }, []);

  const getLanguageLabel = (code: string) => {
    const label = languageDisplayNames?.of(code);
    return label || code;
  };

  const groupedTranslations = useMemo(() => {
    const translations = data?.data ?? [];
    const grouped = new Map<
      string,
      { namespace: string; key_path: string; translations: Translation[] }
    >();

    translations.forEach((trans) => {
      const key = `${trans.namespace}::${trans.key_path}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.translations.push(trans);
      } else {
        grouped.set(key, {
          namespace: trans.namespace,
          key_path: trans.key_path,
          translations: [trans],
        });
      }
    });

    const groups = Array.from(grouped.values()).map((group) => {
      const activeByLanguage = new Map<string, Translation>();
      const deletedByLanguage = new Map<string, Translation>();

      group.translations.forEach((trans) => {
        if (trans.deleted_at) {
          if (!deletedByLanguage.has(trans.language)) {
            deletedByLanguage.set(trans.language, trans);
          }
        } else if (!activeByLanguage.has(trans.language)) {
          activeByLanguage.set(trans.language, trans);
        }
      });

      const displayLanguage =
        (activeByLanguage.has("en") && "en") ||
        languages.find((lang) => activeByLanguage.has(lang)) ||
        Array.from(activeByLanguage.keys())[0] ||
        Array.from(deletedByLanguage.keys())[0];

      let displayTranslation = displayLanguage ? activeByLanguage.get(displayLanguage) : undefined;

      if (!displayTranslation) {
        const firstDeletedLanguage = languages.find((lang) => deletedByLanguage.has(lang));
        const deletedFallback =
          (displayLanguage && deletedByLanguage.get(displayLanguage)) ||
          deletedByLanguage.get("en") ||
          (firstDeletedLanguage ? deletedByLanguage.get(firstDeletedLanguage) : undefined) ||
          group.translations[0];
        displayTranslation = deletedFallback;
      }

      const isArchived = activeByLanguage.size === 0;
      const isIncomplete =
        languages.length > 0 && languages.some((lang) => !activeByLanguage.has(lang));

      return {
        namespace: group.namespace,
        key_path: group.key_path,
        translations: group.translations,
        activeByLanguage,
        deletedByLanguage,
        displayLanguage,
        displayTranslation,
        isArchived,
        isIncomplete,
      };
    });

    return groups;
  }, [data, languages]);

  const filteredTranslations = useMemo(() => {
    const filtered = groupedTranslations.filter((group) => {
      if (showIncompleteOnly && !group.isIncomplete) {
        return false;
      }
      if (language) {
        if (!group.activeByLanguage.has(language)) {
          return false;
        }
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const aKey = `${a.namespace}.${a.key_path}`;
      const bKey = `${b.namespace}.${b.key_path}`;
      return aKey.localeCompare(bKey);
    });
  }, [groupedTranslations, language, showIncompleteOnly]);

  const pagedTranslations = useMemo(() => {
    const start = page * limit;
    return filteredTranslations.slice(start, start + limit);
  }, [filteredTranslations, page, limit]);

  useEffect(() => {
    if (page > 0 && page * limit >= filteredTranslations.length) {
      setPage(0);
    }
  }, [filteredTranslations, page, limit]);

  // Fetch all language versions when editing a key (including deleted ones)
  const { data: editingTranslations } = useQuery({
    queryKey: ["translations", "edit", editingKey?.namespace, editingKey?.key_path],
    queryFn: async () => {
      if (!editingKey) {
        return null;
      }
      // Fetch all translations for this namespace (no language filter, including deleted)
      const response = await translationsApi.list({
        namespace: editingKey.namespace,
        activeOnly: false, // Include deleted translations
        limit: 1000, // Get enough to find all language versions
      });
      // Filter to only exact matches for this key_path
      const filtered = response.data.filter(
        (t) => t.namespace === editingKey.namespace && t.key_path === editingKey.key_path,
      );
      return { data: filtered };
    },
    enabled: !!editingKey,
  });

  //const updateMutation = useMutation({
  //  mutationFn: ({ trans, value }: { trans: Translation; value: string }) =>
  //    translationsApi.update(trans.language, trans.namespace, trans.key_path, { value }),
  //  onSuccess: () => {
  //    queryClient.invalidateQueries({ queryKey: ["translations"] });
  //  },
  //});

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: Array<{ language: string; value: string }>) => {
      if (!editingKey) {
        return;
      }
      const promises = updates.map(async (update) => {
        const existing = editingTranslations?.data.find(
          (t) =>
            t.language === update.language &&
            t.namespace === editingKey.namespace &&
            t.key_path === editingKey.key_path,
        );
        // If there's an active translation, update it (creates new version)
        if (existing && !existing.deleted_at) {
          return translationsApi.update(
            update.language,
            editingKey.namespace,
            editingKey.key_path,
            {
              value: update.value,
            },
          );
        } else {
          // If no translation exists or it's deleted, create a new one
          // The backend will handle restoring deleted translations
          return translationsApi.create({
            namespace: editingKey.namespace,
            key_path: editingKey.key_path,
            language: update.language,
            value: update.value,
          });
        }
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["translations"] });
      setEditingKey(null);
      setEditValues({});
    },
  });

  const createMutation = useMutation({
    mutationFn: () => translationsApi.create(newTranslation),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["translations"] });
      setShowCreate(false);
      setNewTranslation({ namespace: "common", key_path: "", language: "en", value: "" });
    },
  });

  const handleEdit = (target: { namespace: string; key_path: string }) => {
    setEditingKey({ namespace: target.namespace, key_path: target.key_path });
  };

  // Update edit values when editing translations are loaded
  useEffect(() => {
    if (editingKey && editingTranslations?.data) {
      const values: Record<string, string> = {};
      editingTranslations.data.forEach((t) => {
        if (t.namespace === editingKey.namespace && t.key_path === editingKey.key_path) {
          if (!t.deleted_at) {
            values[t.language] = t.value;
          }
        }
      });
      setEditValues(values);
    }
  }, [editingKey, editingTranslations]);

  const handleSave = () => {
    if (!editingKey) {
      return;
    }
    const updates = Object.entries(editValues)
      .filter(([_, value]) => value.trim() !== "")
      .map(([language, value]) => ({ language, value }));
    if (updates.length > 0) {
      bulkUpdateMutation.mutate(updates);
    }
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValues({});
    setExpandedKeys({});
    setShowArchivedByKey({});
  };

  return (
    <div>
      <h1
        style={{
          color: "var(--color-text-primary)",
          marginBottom: "2rem",
          fontSize: "var(--type-page-title-size)",
        }}
      >
        Translations
      </h1>

      <div
        style={{
          marginBottom: "1.5rem",
          padding: "0.75rem 1rem",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-2xs)",
          background: "var(--color-surface)",
        }}
      >
        <div
          style={{
            color: "var(--color-text-primary)",
            fontWeight: "var(--font-weight-semibold)",
            marginBottom: "0.5rem",
          }}
        >
          Latest namespace updates
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            color: "var(--color-text-primary)",
          }}
        >
          {namespacesForUpdates.map((ns) => (
            <span key={ns} style={{ fontSize: "var(--type-body-size)" }}>
              {ns}:{" "}
              {latestUpdateByNamespace[ns]
                ? new Date(latestUpdateByNamespace[ns]).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-"}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <InputControl
          type="search"
          aria-label="Search translations"
          placeholder="Search..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          style={{ flex: "1", minWidth: "200px" }}
        />
        <InputControl
          type="search"
          aria-label="Filter translations by key path"
          placeholder="Filter by key path..."
          value={keyPath}
          onChange={(e) => {
            setKeyPath(e.target.value);
            setPage(0);
          }}
          style={{ minWidth: "200px" }}
        />
        <SelectControl
          aria-label="Filter by language"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setPage(0);
          }}
          style={{ width: "150px" }}
        >
          <option value="">All Languages</option>
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {getLanguageLabel(lang)}
            </option>
          ))}
        </SelectControl>
        <SelectControl
          aria-label="Filter by namespace"
          value={namespace}
          onChange={(e) => {
            setNamespace(e.target.value);
            setPage(0);
          }}
          style={{ width: "150px" }}
        >
          <option value="">All Namespaces</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </SelectControl>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--color-text-primary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showIncompleteOnly}
            onChange={(e) => {
              setShowIncompleteOnly(e.target.checked);
              setPage(0);
            }}
            style={{ cursor: "pointer" }}
          />
          Incomplete only
        </label>
        <Button type="button" variant="primary" onClick={() => setShowCreate(true)}>
          Create New
        </Button>
      </div>

      {showCreate && (
        <div
          style={{
            background: "var(--color-surface)",
            padding: "1.5rem",
            borderRadius: "var(--radius-sm)",
            marginBottom: "2rem",
            border: "1px solid var(--color-border)",
          }}
        >
          <h3 style={{ color: "var(--color-text-primary)", marginBottom: "1rem" }}>
            Create Translation
          </h3>
          <div
            style={{
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "var(--type-supporting-size)",
                  color: "var(--color-text-primary)",
                }}
              >
                Namespace
              </label>
              <SelectControl
                value={newTranslation.namespace}
                onChange={(e) =>
                  setNewTranslation({ ...newTranslation, namespace: e.target.value })
                }
              >
                {namespaces.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </SelectControl>
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "var(--type-supporting-size)",
                  color: "var(--color-text-primary)",
                }}
              >
                Language
              </label>
              <SelectControl
                value={newTranslation.language}
                onChange={(e) => setNewTranslation({ ...newTranslation, language: e.target.value })}
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {getLanguageLabel(lang)}
                  </option>
                ))}
              </SelectControl>
            </div>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "var(--type-supporting-size)",
                color: "var(--color-text-primary)",
              }}
            >
              Key Path
            </label>
            <InputControl
              type="text"
              placeholder="e.g., navigation.home or errors.notFound"
              value={newTranslation.key_path}
              onChange={(e) => setNewTranslation({ ...newTranslation, key_path: e.target.value })}
            />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "var(--type-supporting-size)",
                color: "var(--color-text-primary)",
              }}
            >
              Value
            </label>
            <TextareaControl
              placeholder="Translation value"
              value={newTranslation.value}
              onChange={(e) => setNewTranslation({ ...newTranslation, value: e.target.value })}
              rows={3}
            />
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <Button
              type="button"
              variant="primary"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              isLoading={createMutation.isPending}
            >
              Create
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setNewTranslation({
                  namespace: namespaces[0] ?? "",
                  key_path: "",
                  language: languages[0] ?? "",
                  value: "",
                });
              }}
              style={{ border: "1px solid var(--color-border)" }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {editingKey && editingTranslations && (
        <div
          style={{
            background: "var(--color-surface)",
            padding: "1.5rem",
            borderRadius: "var(--radius-sm)",
            marginBottom: "2rem",
            border: "2px solid var(--color-accent)",
          }}
        >
          <h3 style={{ color: "var(--color-text-primary)", marginBottom: "1rem" }}>
            Editing: {editingKey.namespace}.{editingKey.key_path}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {languages.map((lang) => (
              <div key={lang}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontSize: "var(--type-supporting-size)",
                    color: "var(--color-text-primary)",
                    fontWeight: "var(--font-weight-control-large)",
                  }}
                >
                  {getLanguageLabel(lang)}
                </label>
                <TextareaControl
                  value={editValues[lang] || ""}
                  onChange={(e) => setEditValues({ ...editValues, [lang]: e.target.value })}
                  placeholder={`Translation for ${getLanguageLabel(lang)}...`}
                  rows={2}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                disabled={bulkUpdateMutation.isPending}
                isLoading={bulkUpdateMutation.isPending}
              >
                Save All Languages
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancelEdit}
                style={{ border: "1px solid var(--color-border)" }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ color: "var(--color-text-primary)" }}>Loading...</div>
      ) : (
        <>
          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
              border: "1px solid var(--color-border)",
              overflowX: "auto",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1400px" }}>
              <thead>
                <tr style={{ background: "var(--color-surface-muted)" }}>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      color: "var(--color-text-primary)",
                      borderBottom: "1px solid var(--color-border)",
                      width: "80px",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      color: "var(--color-text-primary)",
                      borderBottom: "1px solid var(--color-border)",
                      width: "120px",
                    }}
                  >
                    Namespace
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      color: "var(--color-text-primary)",
                      borderBottom: "1px solid var(--color-border)",
                      minWidth: "150px",
                    }}
                  >
                    Key Path
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      color: "var(--color-text-primary)",
                      borderBottom: "1px solid var(--color-border)",
                      minWidth: "200px",
                    }}
                  >
                    Term
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      color: "var(--color-text-primary)",
                      borderBottom: "1px solid var(--color-border)",
                      whiteSpace: "nowrap",
                      width: "160px",
                    }}
                  >
                    Created At
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      color: "var(--color-text-primary)",
                      borderBottom: "1px solid var(--color-border)",
                      whiteSpace: "nowrap",
                      width: "160px",
                    }}
                  >
                    Updated At
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      color: "var(--color-text-primary)",
                      borderBottom: "1px solid var(--color-border)",
                      position: "sticky",
                      right: 0,
                      background: "var(--color-surface-muted)",
                      zIndex: 10,
                      minWidth: "150px",
                      width: "150px",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedTranslations.map((group) => {
                  const rowKey = `${group.namespace}::${group.key_path}`;
                  const isEditingThisKey =
                    editingKey?.namespace === group.namespace &&
                    editingKey?.key_path === group.key_path;
                  const isDeleted = group.isArchived;
                  const isExpanded = !!expandedKeys[rowKey];
                  const displayValue = group.displayTranslation?.value || "-";
                  const displayLanguage = group.displayLanguage;
                  const showArchivedForKey = !!showArchivedByKey[rowKey];
                  const handleRowClick = () => {
                    if (isExpanded) {
                      setExpandedKeys({});
                      setEditingKey(null);
                      setShowArchivedByKey({});
                      return;
                    }
                    handleEdit({ namespace: group.namespace, key_path: group.key_path });
                    setExpandedKeys({ [rowKey]: true });
                    setShowArchivedByKey({});
                  };
                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        onClick={handleRowClick}
                        style={{
                          borderBottom: "1px solid var(--color-border)",
                          background: isEditingThisKey
                            ? "var(--color-accent-muted)"
                            : isDeleted
                              ? "var(--color-danger-bg)"
                              : "var(--color-surface)",
                          opacity: isDeleted ? "var(--opacity-subtle)" : "var(--opacity-full)",
                          cursor: "pointer",
                        }}
                      >
                        <td style={{ padding: "0.75rem", color: "var(--color-text-primary)" }}>
                          <div
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "var(--radius-full)",
                              background: group.isIncomplete
                                ? "var(--color-danger)"
                                : "var(--color-success)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "0.75rem", color: "var(--color-text-primary)" }}>
                          {group.namespace}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            color: "var(--color-text-primary)",
                            fontFamily: "var(--font-family-body)",
                            fontSize: "var(--type-supporting-size)",
                          }}
                        >
                          {group.key_path}
                        </td>
                        <td style={{ padding: "0.75rem", color: "var(--color-text-primary)" }}>
                          <button
                            type="button"
                            data-native-ui="table-cell-disclosure"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRowClick();
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "inherit",
                              cursor: "pointer",
                              padding: 0,
                              textAlign: "left",
                              width: "100%",
                            }}
                          >
                            <div
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: "var(--font-weight-control-large)",
                              }}
                            >
                              {displayValue}
                            </div>
                            <div
                              style={{
                                fontSize: "var(--type-supporting-size)",
                                color: "var(--color-text-muted)",
                                marginTop: "0.25rem",
                              }}
                            >
                              {displayLanguage ? getLanguageLabel(displayLanguage) : "No language"}
                            </div>
                          </button>
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            color: "var(--color-text-primary)",
                            fontSize: "var(--type-supporting-size)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {group.displayTranslation?.created_at
                            ? new Date(group.displayTranslation.created_at).toLocaleString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : "-"}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            color: "var(--color-text-primary)",
                            fontSize: "var(--type-supporting-size)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {group.displayTranslation?.updated_at
                            ? new Date(group.displayTranslation.updated_at).toLocaleString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : "-"}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            position: "sticky",
                            right: 0,
                            background: isEditingThisKey
                              ? "var(--color-accent-muted)"
                              : isDeleted
                                ? "var(--color-danger-bg)"
                                : "var(--color-surface)",
                            zIndex: 5,
                            minWidth: "150px",
                            width: "150px",
                            boxShadow: "var(--shadow-e1)",
                          }}
                        >
                          {isEditingThisKey ? (
                            <div
                              style={{
                                color: "var(--color-accent)",
                                fontSize: "var(--type-supporting-size)",
                              }}
                            >
                              Editing...
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleEdit({
                                    namespace: group.namespace,
                                    key_path: group.key_path,
                                  });
                                  setExpandedKeys({ [rowKey]: true });
                                }}
                                style={{ border: "1px solid var(--color-border)" }}
                              >
                                Edit
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr
                          style={{
                            borderBottom: "1px solid var(--color-border)",
                            background: "var(--color-surface-muted)",
                          }}
                        >
                          <td colSpan={7} style={{ padding: "0.75rem 1rem" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "0.75rem",
                              }}
                            >
                              <div style={{ color: "var(--color-text-secondary)" }}>
                                {group.namespace}.{group.key_path}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setShowArchivedByKey((prev) => ({
                                    ...prev,
                                    [rowKey]: !prev[rowKey],
                                  }));
                                }}
                                style={{
                                  background: showArchivedForKey
                                    ? "var(--color-accent)"
                                    : "transparent",
                                  border: "1px solid var(--color-border)",
                                }}
                              >
                                {showArchivedForKey ? "Hide Archive" : "Archive"}
                              </Button>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                              }}
                            >
                              {languages.map((lang) => {
                                const activeTranslation = group.activeByLanguage.get(lang);
                                const deletedTranslation = editingTranslations?.data.find(
                                  (t) =>
                                    t.language === lang &&
                                    t.namespace === group.namespace &&
                                    t.key_path === group.key_path &&
                                    !!t.deleted_at,
                                );
                                const showDeleted =
                                  showArchivedForKey && !activeTranslation && deletedTranslation;
                                const value = activeTranslation?.value
                                  ? activeTranslation.value
                                  : showArchivedForKey
                                    ? deletedTranslation?.value
                                    : undefined;
                                return (
                                  <div key={lang}>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "1rem",
                                        alignItems: "flex-start",
                                      }}
                                    >
                                      <div
                                        style={{
                                          minWidth: "140px",
                                          fontWeight: "var(--font-weight-semibold)",
                                          color: "var(--color-text-primary)",
                                        }}
                                      >
                                        {getLanguageLabel(lang)}
                                      </div>
                                      <div
                                        style={{
                                          color: value
                                            ? "var(--color-text-primary)"
                                            : "var(--color-text-muted)",
                                          whiteSpace: "pre-wrap",
                                        }}
                                      >
                                        {value || "Missing"}
                                      </div>
                                      {showDeleted && (
                                        <span
                                          style={{
                                            fontSize: "var(--type-supporting-size)",
                                            color: "var(--color-danger-text)",
                                            border: "1px solid var(--color-danger)",
                                            borderRadius: "var(--radius-2xs)",
                                            padding: "0.1rem 0.35rem",
                                          }}
                                        >
                                          Deleted
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredTranslations.length > limit && (
            <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", alignItems: "center" }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span style={{ color: "var(--color-text-primary)" }}>
                Page {page + 1} of {Math.ceil(filteredTranslations.length / limit)}
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * limit >= filteredTranslations.length}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TranslationsPage;
