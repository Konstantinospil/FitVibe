import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { Eye, EyeOff } from "lucide-react";

export interface DataTableColumn {
  key: string;
  label: string;
  render?: (value: unknown, row: DataTableRow) => React.ReactNode;
  align?: "left" | "right" | "center";
}

export interface DataTableRow {
  [key: string]: unknown;
}

export interface DataTableProps {
  title?: string;
  columns: DataTableColumn[];
  data: DataTableRow[];
  loading?: boolean;
  emptyMessage?: string;
  showToggle?: boolean;
  summaryText?: string;
}

/**
 * DataTable component provides an accessible data table for chart data.
 * Includes toggle for showing/hiding table view and proper ARIA labels.
 */
export const DataTable: React.FC<DataTableProps> = ({
  title,
  columns,
  data,
  loading = false,
  emptyMessage,
  showToggle = true,
  summaryText,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  if (loading) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex flex--column flex--gap-md">
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: "40px", background: "var(--color-surface-muted)" }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div
            className="flex flex--center"
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            {emptyMessage || "No data available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {title && (
        <CardHeader>
          <div className="flex flex--justify-between flex--align-center">
            <CardTitle>{title}</CardTitle>
            {showToggle && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(!isVisible)}
                leftIcon={isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                aria-label={isVisible ? "Hide data table" : "Show data table"}
              >
                {isVisible ? "Hide Table" : "Show Table"}
              </Button>
            )}
          </div>
        </CardHeader>
      )}
      {(!showToggle || isVisible) && (
        <CardContent>
          {summaryText && (
            <p className="text-sm text-secondary mb-md" style={{ marginBottom: "1rem" }}>
              {summaryText}
            </p>
          )}
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.9rem",
              }}
              role="table"
              aria-label={title || "Data table"}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    textAlign: "left",
                  }}
                >
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      style={{
                        padding: "0.75rem 0",
                        color: "var(--color-text-secondary)",
                        textAlign: column.align || "left",
                        fontWeight: 600,
                      }}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        style={{
                          padding: "1rem 0",
                          textAlign: column.align || "left",
                        }}
                      >
                        {column.render
                          ? column.render(row[column.key], row)
                          : (() => {
                              const value = row[column.key];
                              if (value === null || value === undefined) {
                                return "";
                              }
                              if (typeof value === "object") {
                                return JSON.stringify(value);
                              }
                              if (typeof value === "string") {
                                return value;
                              }
                              if (typeof value === "number" || typeof value === "boolean") {
                                return String(value);
                              }
                              if (typeof value === "symbol" || typeof value === "bigint") {
                                return value.toString();
                              }
                              // Fallback for any other type - should not happen in practice
                              return JSON.stringify(value);
                            })()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
