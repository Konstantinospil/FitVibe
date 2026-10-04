import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Edit, Plus, Save, X } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { InputControl, SelectControl, TextareaControl } from "@fitvibe/ui";
import {
  listTranslations,
  createTranslation,
  updateTranslation,
  getTranslationMetadata,
  type TranslationRecord,
  type SupportedLanguage,
  type TranslationNamespace,
} from "../../services/translations.api";
import { useToast } from "../../contexts/ToastContext";

const Translations: React.FC = () => {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [selectedNamespace, setSelectedNamespace] = useState<TranslationNamespace>("all");
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("");
  const [languages, setLanguages] = useState<SupportedLanguage[]>([]);
  const [namespaces, setNamespaces] = useState<TranslationNamespace[]>([]);
  const [activeOnly, setActiveOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [translations, setTranslations] = useState<TranslationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Editing state
  const [editingKey, setEditingKey] = useState<{
    language: SupportedLanguage;
    namespace: TranslationNamespace;
    keyPath: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Create new translation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTranslation, setNewTranslation] = useState<{
    namespace: TranslationNamespace;
    key_path: string;
    language: SupportedLanguage;
    value: string;
  }>({
    namespace: "" as TranslationNamespace,
    key_path: "",
    language: "" as SupportedLanguage,
    value: "",
  });

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

  const loadTranslations = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        language: selectedLanguage || undefined,
        namespace: selectedNamespace !== "all" ? selectedNamespace : undefined,
        search: searchQuery.trim() || undefined,
        keyPath: keyPath.trim() || undefined,
        activeOnly: activeOnly ? undefined : false, // false shows all, undefined shows only active
        limit: pageSize,
        offset: page * pageSize,
      };

      const response = await listTranslations(params);
      setTranslations(response.data);
      setTotal(response.pagination.total);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load translations";
      toast.error(errorMessage);
      console.error("Failed to load translations:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedLanguage, selectedNamespace, searchQuery, keyPath, activeOnly, page, toast]);

  useEffect(() => {
    void loadTranslations();
  }, [loadTranslations]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await getTranslationMetadata();
        setLanguages(response.data.languages);
        setNamespaces(response.data.namespaces);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load metadata";
        toast.error(errorMessage);
      }
    };

    void fetchMetadata();
  }, [toast]);

  useEffect(() => {
    if (languages.length > 0 && !selectedLanguage) {
      setSelectedLanguage(languages[0]);
    }
    if (languages.length > 0 && !newTranslation.language) {
      setNewTranslation((prev) => ({ ...prev, language: languages[0] }));
    }
  }, [languages, newTranslation.language, selectedLanguage]);

  useEffect(() => {
    if (namespaces.length > 0 && !newTranslation.namespace) {
      setNewTranslation((prev) => ({ ...prev, namespace: namespaces[0] }));
    }
  }, [namespaces, newTranslation.namespace]);

  const handleEdit = (translation: TranslationRecord) => {
    setEditingKey({
      language: translation.language,
      namespace: translation.namespace,
      keyPath: translation.key_path,
    });
    setEditValue(translation.value);
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    if (!editingKey) {
      return;
    }

    try {
      await updateTranslation(editingKey.language, editingKey.namespace, editingKey.keyPath, {
        value: editValue,
      });
      toast.success("Translation updated successfully");
      setEditingKey(null);
      setEditValue("");
      void loadTranslations();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update translation";
      toast.error(errorMessage);
    }
  };

  const handleCreate = async () => {
    if (!newTranslation.key_path.trim() || !newTranslation.value.trim()) {
      toast.error("Key path and value are required");
      return;
    }

    try {
      await createTranslation(newTranslation);
      toast.success("Translation created successfully");
      setShowCreateForm(false);
      setNewTranslation({
        namespace: namespaces[0] ?? ("" as TranslationNamespace),
        key_path: "",
        language: languages[0] ?? ("" as SupportedLanguage),
        value: "",
      });
      void loadTranslations();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create translation";
      toast.error(errorMessage);
    }
  };

  return (
    <div className="grid grid--gap-15">
      <Card>
        <CardHeader>
          <CardTitle>Translation Management</CardTitle>
          <CardDescription>
            Manage application translations across all languages and namespaces
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "1.5rem",
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div style={{ flex: "1", minWidth: "200px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "var(--type-supporting-size)",
                  fontWeight: "var(--font-weight-control-large)",
                }}
              >
                Search
              </label>
              <div style={{ position: "relative" }}>
                <Search
                  size={18}
                  style={{
                    position: "absolute",
                    left: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-secondary)",
                  }}
                />
                <InputControl
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search by key or value..."
                  className="form-input"
                  style={{ paddingLeft: "2.5rem" }}
                />
              </div>
            </div>

            <div style={{ flex: "1", minWidth: "200px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "var(--type-supporting-size)",
                  fontWeight: "var(--font-weight-control-large)",
                }}
              >
                Key Path
              </label>
              <InputControl
                type="search"
                value={keyPath}
                onChange={(e) => {
                  setKeyPath(e.target.value);
                  setPage(0);
                }}
                placeholder="Filter by key path..."
                className="form-input"
              />
            </div>

            <div style={{ minWidth: "150px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "var(--type-supporting-size)",
                  fontWeight: "var(--font-weight-control-large)",
                }}
              >
                Namespace
              </label>
              <SelectControl
                value={selectedNamespace}
                onChange={(e) => {
                  setSelectedNamespace(e.target.value);
                  setPage(0);
                }}
                className="form-input"
              >
                <option value="all">All Namespaces</option>
                {namespaces.map((ns) => (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                ))}
              </SelectControl>
            </div>

            <div style={{ minWidth: "150px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "var(--type-supporting-size)",
                  fontWeight: "var(--font-weight-control-large)",
                }}
              >
                Language
              </label>
              <SelectControl
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  setPage(0);
                }}
                className="form-input"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {getLanguageLabel(lang)}
                  </option>
                ))}
              </SelectControl>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                  fontSize: "var(--type-supporting-size)",
                  fontWeight: "var(--font-weight-control-large)",
                }}
              >
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => {
                    setActiveOnly(e.target.checked);
                    setPage(0);
                  }}
                  style={{ cursor: "pointer" }}
                />
                Show only active
              </label>
            </div>

            <Button onClick={() => setShowCreateForm(true)} style={{ whiteSpace: "nowrap" }}>
              <Plus size={18} style={{ marginRight: "0.5rem" }} />
              Add Translation
            </Button>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <Card style={{ marginBottom: "1.5rem", borderColor: "var(--color-accent)" }}>
              <CardContent style={{ padding: "1.5rem" }}>
                <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Create New Translation</h3>
                <div
                  style={{
                    display: "grid",
                    gap: "1rem",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  }}
                >
                  <div>
                    <label
                      style={{ display: "block", marginBottom: "0.5rem", fontSize: "var(--type-supporting-size)" }}
                    >
                      Namespace
                    </label>
                    <SelectControl
                      value={newTranslation.namespace}
                      onChange={(e) =>
                        setNewTranslation({
                          ...newTranslation,
                          namespace: e.target.value,
                        })
                      }
                      className="form-input"
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
                      style={{ display: "block", marginBottom: "0.5rem", fontSize: "var(--type-supporting-size)" }}
                    >
                      Language
                    </label>
                    <SelectControl
                      value={newTranslation.language}
                      onChange={(e) =>
                        setNewTranslation({
                          ...newTranslation,
                          language: e.target.value,
                        })
                      }
                      className="form-input"
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
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "var(--type-supporting-size)" }}>
                    Key Path
                  </label>
                  <InputControl
                    type="text"
                    value={newTranslation.key_path}
                    onChange={(e) =>
                      setNewTranslation({ ...newTranslation, key_path: e.target.value })
                    }
                    placeholder="e.g., navigation.home or errors.notFound"
                    className="form-input"
                  />
                </div>
                <div style={{ marginTop: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "var(--type-supporting-size)" }}>
                    Value
                  </label>
                  <TextareaControl
                    value={newTranslation.value}
                    onChange={(e) =>
                      setNewTranslation({ ...newTranslation, value: e.target.value })
                    }
                    placeholder="Translation value"
                    className="form-input"
                    rows={3}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                  <Button onClick={() => void handleCreate()}>Create</Button>
                  <Button variant="secondary" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Translations List */}
          {loading && translations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>Loading translations...</div>
          ) : translations.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary)" }}
            >
              No translations found
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "1rem", color: "var(--color-text-secondary)" }}>
                Showing {translations.length} of {total} translations
              </div>
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1400px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "left",
                          fontWeight: "var(--font-weight-semibold)",
                          width: "100px",
                        }}
                      >
                        Language
                      </th>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "left",
                          fontWeight: "var(--font-weight-semibold)",
                          width: "120px",
                        }}
                      >
                        Namespace
                      </th>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "left",
                          fontWeight: "var(--font-weight-semibold)",
                          minWidth: "150px",
                        }}
                      >
                        Key Path
                      </th>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "left",
                          fontWeight: "var(--font-weight-semibold)",
                          minWidth: "200px",
                        }}
                      >
                        Term
                      </th>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "left",
                          fontWeight: "var(--font-weight-semibold)",
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
                          fontWeight: "var(--font-weight-semibold)",
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
                          fontWeight: "var(--font-weight-semibold)",
                          whiteSpace: "nowrap",
                          width: "160px",
                        }}
                      >
                        Deleted At
                      </th>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "right",
                          fontWeight: "var(--font-weight-semibold)",
                          position: "sticky",
                          right: 0,
                          background: "var(--color-background)",
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
                    {translations.map((translation) => {
                      const isEditing =
                        editingKey?.language === translation.language &&
                        editingKey?.namespace === translation.namespace &&
                        editingKey?.keyPath === translation.key_path;
                      const isDeleted = !!translation.deleted_at;

                      return (
                        <tr
                          key={`${translation.namespace}-${translation.key_path}-${translation.language}`}
                          style={{
                            borderBottom: "1px solid var(--color-border)",
                            opacity: isDeleted ? 0.7 : 1,
                            background: isDeleted ? "var(--surface-deleted-subtle)" : "transparent",
                          }}
                        >
                          <td style={{ padding: "0.75rem" }}>
                            {getLanguageLabel(translation.language)}
                          </td>
                          <td style={{ padding: "0.75rem" }}>{translation.namespace}</td>
                          <td
                            style={{
                              padding: "0.75rem",
                              fontFamily: "var(--font-family-body)",
                              fontSize: "var(--type-supporting-size)",
                            }}
                          >
                            {translation.key_path}
                          </td>
                          <td style={{ padding: "0.75rem", maxWidth: "400px" }}>
                            {isEditing ? (
                              <TextareaControl
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="form-input"
                                rows={2}
                                style={{ width: "100%" }}
                              />
                            ) : (
                              <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                {translation.value}
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "0.75rem",
                              fontSize: "var(--type-supporting-size)",
                              color: "var(--color-text-secondary)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {translation.created_at
                              ? new Date(translation.created_at).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>
                          <td
                            style={{
                              padding: "0.75rem",
                              fontSize: "var(--type-supporting-size)",
                              color: "var(--color-text-secondary)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {translation.updated_at
                              ? new Date(translation.updated_at).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>
                          <td
                            style={{
                              padding: "0.75rem",
                              fontSize: "var(--type-supporting-size)",
                              color: isDeleted
                                ? "var(--color-error)"
                                : "var(--color-text-secondary)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {translation.deleted_at
                              ? new Date(translation.deleted_at).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </td>
                          <td
                            style={{
                              padding: "0.75rem",
                              textAlign: "right",
                              position: "sticky",
                              right: 0,
                              background: isDeleted
                                ? "var(--surface-deleted-subtle)"
                                : "var(--color-background)",
                              zIndex: 5,
                              minWidth: "150px",
                              width: "150px",
                            }}
                          >
                            {isEditing ? (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.5rem",
                                  justifyContent: "flex-end",
                                }}
                              >
                                <Button size="sm" onClick={() => void handleSaveEdit()}>
                                  <Save size={16} />
                                </Button>
                                <Button size="sm" variant="secondary" onClick={handleCancelEdit}>
                                  <X size={16} />
                                </Button>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.5rem",
                                  justifyContent: "flex-end",
                                }}
                              >
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleEdit(translation)}
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > pageSize && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "1.5rem",
                  }}
                >
                  <div style={{ color: "var(--color-text-secondary)" }}>
                    Page {page + 1} of {Math.ceil(total / pageSize)}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button
                      variant="secondary"
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setPage(Math.min(Math.ceil(total / pageSize) - 1, page + 1))}
                      disabled={page >= Math.ceil(total / pageSize) - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Translations;
