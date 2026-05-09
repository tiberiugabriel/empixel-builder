import React, { lazy, Suspense } from "react";
import type { FieldDef, FieldType, StandardFieldDef, CustomFieldDef, FieldRenderProps } from "../blockDefinitions.js";
import { JsonArrayField } from "./JsonArrayField.js";
import { LinkControl, type LinkValue } from "../controls/LinkControl.js";
import { FieldGroup, SelectRow } from "../controls/FieldRow.js";
import { NumberWithUnits } from "../controls/NumberWithUnits.js";
import { IconGroup } from "../controls/IconGroup.js";
import { RichTextField } from "./RichTextField.js";
import type { IconGroupValue, BreakpointId, SectionBlock } from "../../types.js";

/**
 * F4.3 — `CodeEditor` (~359 LOC + the full HTML/CSS/JS autocomplete
 * tables) is consumed in two places: this Fields-tab `code` renderer
 * and the Advanced-tab Custom CSS textarea. Lazy-import here so a
 * block that doesn't expose a `code`-typed field never pulls the
 * editor into its initial chunk. The Advanced tab does its own lazy
 * import — see `right-panel/AdvancedTab.tsx`.
 */
const CodeEditor = lazy(() =>
  import("../controls/CodeEditor.js").then((m) => ({ default: m.CodeEditor })),
);

/**
 * Standard `FieldDef` props — read by the per-`type` renderers below.
 * Custom `FieldDef` (`kind: "custom"`) takes a separate render path
 * (see `FieldRenderer` dispatch) and never enters this map.
 */
interface Props {
  field: StandardFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  isDirty?: boolean;
}

type FieldComponent = React.FC<Props>;

const Link: FieldComponent = ({ value, onChange }) => {
  const linkVal: LinkValue = value && typeof value === "object" ? (value as LinkValue) : {};
  return <LinkControl value={linkVal} onChange={(v) => onChange(v)} />;
};

const JsonArray: FieldComponent = ({ field, value, onChange }) => (
  <JsonArrayField
    field={field}
    value={Array.isArray(value) ? value : []}
    onChange={onChange}
  />
);

const RichText: FieldComponent = ({ field, value, onChange, isDirty }) => {
  const dc = isDirty ? " is-dirty" : "";
  return (
    <div className={`epx-field${dc}`}>
      <label className={field.labelClassName ?? "epx-field__label"}>{field.label}</label>
      <RichTextField
        value={Array.isArray(value) ? value : []}
        onChange={(v) => onChange(v)}
        placeholder={field.placeholder}
      />
    </div>
  );
};

const Code: FieldComponent = ({ field, value, onChange, isDirty }) => {
  const dc = isDirty ? " is-dirty" : "";
  return (
    <div className={`epx-field${dc}`}>
      <label className={field.labelClassName ?? "epx-field__label"}>{field.label}</label>
      <Suspense
        fallback={
          <div
            className="epx-code-editor epx-code-editor--loading"
            aria-busy="true"
            style={{ minHeight: 140 }}
          />
        }
      >
        <CodeEditor
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(v)}
          language={field.language ?? "html"}
          placeholder={field.placeholder}
        />
      </Suspense>
    </div>
  );
};

const NumberUnits: FieldComponent = ({ field, value, onChange }) => (
  <NumberWithUnits
    label={field.label}
    value={typeof value === "string" ? value : undefined}
    onChange={(v) => onChange(v)}
    units={field.units}
  />
);

const IconGroupField: FieldComponent = ({ field, value, onChange }) => (
  <IconGroup
    label={field.label}
    value={(value as IconGroupValue) ?? undefined}
    onChange={(v) => onChange(v)}
    showPosition={field.showPosition}
  />
);

const Toggle: FieldComponent = ({ field, value, onChange }) => {
  const checked = Boolean(value);
  return (
    <FieldGroup isDirty={checked} onReset={() => onChange(false)}>
      <div className="epx-side-input">
        <span className="epx-side-input__label epx-side-input__label--row epx-row-label--section">{field.label}</span>
        <label className="epx-toggle" style={{ marginLeft: "auto", paddingRight: 8 }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="epx-toggle__track"><span className="epx-toggle__thumb" /></span>
        </label>
      </div>
    </FieldGroup>
  );
};

const Select: FieldComponent = ({ field, value, onChange, isDirty }) => {
  const dc = isDirty ? " is-dirty" : "";
  const strVal = typeof value === "string" ? value : "";
  if (field.labelClassName) {
    return (
      <FieldGroup isDirty={!!strVal} onReset={() => onChange("")}>
        <SelectRow
          label={field.label}
          value={strVal}
          onChange={(v) => onChange(v)}
          options={field.options ?? []}
          labelClassName={field.labelClassName}
        />
      </FieldGroup>
    );
  }
  return (
    <div className={`epx-field${dc}`}>
      <label className="epx-field__label">{field.label}</label>
      <select
        className="epx-field__select"
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select —</option>
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
};

const Textarea: FieldComponent = ({ field, value, onChange, isDirty }) => {
  const dc = isDirty ? " is-dirty" : "";
  return (
    <div className={`epx-field${dc}`}>
      <label htmlFor={field.key} className={field.labelClassName ?? "epx-field__label"}>{field.label}</label>
      <textarea
        id={field.key}
        className="epx-field__textarea"
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    </div>
  );
};

const Number_: FieldComponent = ({ field, value, onChange, isDirty }) => {
  const dc = isDirty ? " is-dirty" : "";
  return (
    <div className={`epx-field${dc}`}>
      <label className="epx-field__label">{field.label}</label>
      <input
        type="number"
        className="epx-field__input"
        value={typeof value === "number" ? value : ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(globalThis.Number(e.target.value))}
      />
    </div>
  );
};

const Text: FieldComponent = ({ field, value, onChange, isDirty }) => {
  const dc = isDirty ? " is-dirty" : "";
  return (
    <div className={`epx-field${dc}`}>
      <label className="epx-field__label">
        {field.label}
        {field.required && <span className="epx-field__required">*</span>}
      </label>
      <input
        type={field.type === "url" ? "url" : "text"}
        className="epx-field__input"
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

// Map dispatch — TS exhaustiveness checks every FieldType has a renderer.
// Adding a new FieldType to the union forces this map to update or fail to
// compile, which removes the silent fall-through risk of the old if-chain.
const RENDERERS: Record<FieldType, FieldComponent> = {
  link: Link,
  "json-array": JsonArray,
  "rich-text": RichText,
  code: Code,
  "number-units": NumberUnits,
  "icon-group": IconGroupField,
  toggle: Toggle,
  select: Select,
  textarea: Textarea,
  number: Number_,
  text: Text,
  url: Text,
};

/**
 * Public dispatcher. Accepts the full `FieldDef` union — standard
 * input-style entries route through the per-`type` map; `kind:"custom"`
 * entries call their own `render` prop with `FieldRenderProps`.
 *
 * Custom fields receive `block` / `onChange` / `activeBreakpoint` from
 * the panel (passed through as `customCtx`) and dispatch their own
 * patches; they bypass the standard `(value, onChange)` flow because
 * they typically write multiple keys at once. F3.5.6 introduced this
 * variant for `container` and `video` Fields tabs.
 */
export interface FieldRendererProps {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  isDirty?: boolean;
  /**
   * Context for `kind: "custom"` renderers. The Fields-tab dispatcher
   * (`TabRenderer`) passes this through; standard-`type` renderers
   * ignore it. Optional so existing callers compile.
   */
  customCtx?: {
    block: SectionBlock;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    panelOnChange: (next: Record<string, any>) => void;
    activeBreakpoint: BreakpointId;
  };
}

export function FieldRenderer(props: FieldRendererProps) {
  if (props.field.kind === "custom") {
    if (!props.customCtx) {
      // Defensive — TabRenderer always supplies `customCtx` for the
      // Fields tab. If a non-context caller hits a custom field, render
      // nothing rather than crash.
      return null;
    }
    const fieldRenderProps: FieldRenderProps = {
      block: props.customCtx.block,
      onChange: props.customCtx.panelOnChange,
      activeBreakpoint: props.customCtx.activeBreakpoint,
    };
    const node = (props.field as CustomFieldDef).render(fieldRenderProps);
    return <>{node}</>;
  }
  const standard = props.field as StandardFieldDef;
  const Renderer = RENDERERS[standard.type];
  return (
    <Renderer
      field={standard}
      value={props.value}
      onChange={props.onChange}
      isDirty={props.isDirty}
    />
  );
}
