import React, { useState } from "react";

export interface DateRange {
  from: string; // ISO date string (YYYY-MM-DD)
  to: string; // ISO date string (YYYY-MM-DD)
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  maxDate?: string;
  minDate?: string;
}

const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--surface-muted-subtle)",
  color: "var(--color-text-primary)",
  fontSize: "var(--type-body-size)",
  cursor: "pointer",
};

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const labelStyle: React.CSSProperties = {
  fontSize: "var(--type-body-size)",
  color: "var(--color-text-secondary)",
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  maxDate = new Date().toISOString().split("T")[0],
  minDate,
}) => {
  const [localFrom, setLocalFrom] = useState(value.from);
  const [localTo, setLocalTo] = useState(value.to);

  const handleFromChange = (newFrom: string) => {
    setLocalFrom(newFrom);
    // If 'from' is after 'to', adjust 'to' to match 'from'
    if (newFrom > localTo) {
      setLocalTo(newFrom);
      onChange({ from: newFrom, to: newFrom });
    } else {
      onChange({ from: newFrom, to: localTo });
    }
  };

  const handleToChange = (newTo: string) => {
    setLocalTo(newTo);
    // If 'to' is before 'from', adjust 'from' to match 'to'
    if (newTo < localFrom) {
      setLocalFrom(newTo);
      onChange({ from: newTo, to: newTo });
    } else {
      onChange({ from: localFrom, to: newTo });
    }
  };

  return (
    <div style={containerStyle}>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={labelStyle}>From:</span>
        <input
          type="date"
          value={localFrom}
          onChange={(e) => handleFromChange(e.target.value)}
          max={maxDate}
          min={minDate}
          style={inputStyle}
        />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={labelStyle}>To:</span>
        <input
          type="date"
          value={localTo}
          onChange={(e) => handleToChange(e.target.value)}
          max={maxDate}
          min={minDate}
          style={inputStyle}
        />
      </label>
    </div>
  );
};

export default DateRangePicker;
