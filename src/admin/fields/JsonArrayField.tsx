import React, { useState } from "react";
import type { StandardFieldDef } from "../blockDefinitions.js";

interface Props {
  field: StandardFieldDef;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: Record<string, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (value: Record<string, any>[]) => void;
}

export function JsonArrayField({ field, value, onChange }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Only standard sub-fields are renderable here. Custom (`kind:"custom"`)
  // entries are top-level only and never appear inside JsonArrayField's
  // `itemFields` schema.
  const subFields = (field.itemFields ?? []).filter(
    (f): f is StandardFieldDef => f.kind !== "custom",
  );

  const addItem = () => {
    const emptyItem = Object.fromEntries(
      subFields.map((f) => [f.key, f.type === "toggle" ? false : ""])
    );
    const next = [...value, emptyItem];
    onChange(next);
    setExpandedIndex(next.length - 1);
  };

  const updateItem = (index: number, key: string, val: unknown) => {
    onChange(value.map((item, i) => (i === index ? { ...item, [key]: val } : item)));
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= value.length) return;
    const next = [...value];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onChange(next);
    setExpandedIndex(newIndex);
  };

  return (
    <div className="epx-json-array">
      <div className="epx-json-array__header">
        <span className="epx-field__label">{field.label}</span>
        <span className="epx-json-array__count">{value.length} item{value.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="epx-json-array__list">
        {value.map((item, i) => (
          <div key={i} className={`epx-json-array__item ${expandedIndex === i ? "is-expanded" : ""}`}>
            <div
              className="epx-json-array__item-header"
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            >
              <span className="epx-json-array__item-label">
                {item.title || item.name || item.author || item.question || item.value || `Item ${i + 1}`}
              </span>
              <div className="epx-json-array__item-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="epx-icon-btn"
                  onClick={() => moveItem(i, -1)}
                  disabled={i === 0}
                  title="Move up"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  className="epx-icon-btn"
                  onClick={() => moveItem(i, 1)}
                  disabled={i === value.length - 1}
                  title="Move down"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  className="epx-icon-btn epx-icon-btn--danger"
                  onClick={() => removeItem(i)}
                  title="Remove"
                  aria-label="Remove item"
                >
                  ×
                </button>
              </div>
            </div>

            {expandedIndex === i && (
              <div className="epx-json-array__item-body">
                {subFields.map((subField) => (
                  <SubField
                    key={subField.key}
                    field={subField}
                    value={item[subField.key]}
                    onChange={(val) => updateItem(i, subField.key, val)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button className="epx-btn-add" onClick={addItem}>
        + Add {field.label.replace(/s$/, "")}
      </button>
    </div>
  );
}

function SubField({
  field,
  value,
  onChange,
}: {
  field: StandardFieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  if (field.type === "toggle") {
    return (
      <div className="epx-field epx-field--toggle">
        <label className="epx-field__toggle-label">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="epx-field__label">{field.label}</span>
        </label>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="epx-field">
        <label className="epx-field__label">{field.label}</label>
        <textarea
          className="epx-field__textarea"
          value={typeof value === "string" ? value : ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      </div>
    );
  }

  return (
    <div className="epx-field">
      <label className="epx-field__label">{field.label}</label>
      <input
        type={field.type === "url" ? "url" : "text"}
        className="epx-field__input"
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
