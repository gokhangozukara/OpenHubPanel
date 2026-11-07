import rawSections from "../../../../../infra/connectors/fields.json";
import { digest, event, state, transaction } from "./store";

export const ownerSections: Record<string, [string, string, string][]> = Object.fromEntries(
  Object.entries(rawSections).map(([section, fields]) => [
    section,
    fields.map((field) => {
      const [name, label, type] = field;
      if (!name || !label || !type || field.length !== 3) throw new Error("Invalid field schema");
      return [name, label, type] as [string, string, string];
    }),
  ]),
);
const metadataFields = [
  ["name", "Application name", "text"],
  ["package", "Package or bundle ID", "text"],
  ["category", "Category", "text"],
] as const;
const names = (section: string) => ownerSections[section] ?? [];
function defaults() {
  return Object.fromEntries(
    Object.values(ownerSections)
      .flat()
      .map(([name, , type]) => [
        name,
        type === "boolean" ? false : type === "integer" ? 0 : name === "popup_frequency" ? "once" : "",
      ]),
  );
}
function metadata(row: Record<string, unknown>) {
  return { name: String(row.name), package: String(row.package), category: String(row.category) };
}
function configuration(row: Record<string, unknown>, section: string) {
  const config = JSON.parse(String(row.config)) as Record<string, unknown>;
  const fields = names(section);
  const values = Object.fromEntries(fields.map(([name]) => [name, config[name]]));
  return {
    fields: fields.map(([name, label, type]) => ({ name, label, type })),
    values,
    revision: digest(JSON.stringify(values)),
  };
}
export function embeddedConnector(path: string, method = "GET", payload?: unknown): Record<string, unknown> {
  const db = state();
  try {
    if (path === "/apps" && method === "GET")
      return {
        applications: db
          .prepare("SELECT * FROM operator_application ORDER BY sort")
          .all()
          .map((row) => ({
            id: row.id,
            name: row.name,
            packageName: row.package,
            category: row.category,
            version: JSON.parse(String(row.config)).latest_version || "",
            maintenance: Boolean(JSON.parse(String(row.config)).maintenance_mode),
          })),
      };
    if (path === "/audit" && method === "GET")
      return db
        .prepare(
          "SELECT time,app,section,fields,request_id FROM operator_application_audit ORDER BY id DESC LIMIT 100",
        )
        .all() as unknown as Record<string, unknown>;
    const operation = /^\/operations\/([a-f0-9-]{36})$/.exec(path);
    if (operation && method === "GET") {
      const row = db
        .prepare("SELECT result FROM operator_local_operation WHERE id=?")
        .get(operation[1] ?? "");
      if (!row) throw new Error("APPLICATION_NOT_FOUND");
      return JSON.parse(String(row.result));
    }
    const target = /^\/apps\/([a-z0-9][a-z0-9-]{0,63})\/settings\/([a-z]+)$/.exec(path);
    if (!target) throw new Error("APPLICATION_NOT_FOUND");
    const id = target[1] ?? "",
      section = target[2] ?? "";
    if (!Object.hasOwn(ownerSections, section) && !["application", "push"].includes(section))
      throw new Error("APPLICATION_NOT_FOUND");
    const row = db.prepare("SELECT * FROM operator_application WHERE id=?").get(id);
    if (method === "GET") {
      if (!row) throw new Error("APPLICATION_NOT_FOUND");
      if (section === "application") {
        const values = metadata(row);
        return {
          fields: metadataFields.map(([name, label, type]) => ({ name, label, type })),
          values,
          revision: digest(JSON.stringify(values)),
        };
      }
      if (section === "push")
        return { fields: [], values: {}, revision: digest(id), ready: false, topic: "", history: [] };
      return configuration(row, section);
    }
    if (method !== "PUT" || !payload || typeof payload !== "object") throw new Error("INVALID_REQUEST");
    const input = payload as { requestId: string; revision: string; values: Record<string, unknown> };
    if (
      !/^[a-f0-9-]{36}$/.test(input.requestId) ||
      !/^[a-f0-9]{64}$/.test(input.revision) ||
      !input.values ||
      typeof input.values !== "object" ||
      Array.isArray(input.values)
    )
      throw new Error("INVALID_REQUEST");
    if (section === "push") throw new Error("PUSH_NOT_CONFIGURED");
    const hash = digest(JSON.stringify({ id, section, input }));
    return transaction(db, () => {
      const previous = db.prepare("SELECT * FROM operator_local_operation WHERE id=?").get(input.requestId);
      if (previous) {
        if (previous.payload_hash !== hash) throw new Error("CONFLICT");
        return JSON.parse(String(previous.result));
      }
      const current = db.prepare("SELECT * FROM operator_application WHERE id=?").get(id);
      let revision: string;
      if (section === "application") {
        const value = input.values;
        if (
          Object.keys(value).length !== 3 ||
          metadataFields.some(([name]) => typeof value[name] !== "string") ||
          !String(value.name).trim() ||
          String(value.name).length > 100 ||
          String(value.category).length > 100 ||
          String(value.package).length > 200 ||
          (value.package &&
            !/^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)+$/.test(String(value.package)))
        )
          throw new Error("INVALID_REQUEST");
        const create = input.revision === "0".repeat(64);
        if (
          create ? Boolean(current) : !current || digest(JSON.stringify(metadata(current))) !== input.revision
        )
          throw new Error("CONFLICT");
        const values = {
          name: String(value.name).trim(),
          package: String(value.package).trim(),
          category: String(value.category).trim(),
        };
        if (create)
          db.prepare(
            "INSERT INTO operator_application(id,name,package,category,sort,config) VALUES(?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM operator_application),?)",
          ).run(id, values.name, values.package, values.category, JSON.stringify(defaults()));
        else
          db.prepare("UPDATE operator_application SET name=?,package=?,category=? WHERE id=?").run(
            values.name,
            values.package,
            values.category,
            id,
          );
        revision = digest(JSON.stringify(values));
      } else {
        if (!current) throw new Error("APPLICATION_NOT_FOUND");
        const config = configuration(current, section);
        if (config.revision !== input.revision) throw new Error("CONFLICT");
        const fields = names(section);
        if (
          Object.keys(input.values).length !== fields.length ||
          fields.some(([name, , type]) => {
            const value = input.values[name];
            return type === "boolean"
              ? typeof value !== "boolean"
              : type === "integer"
                ? !Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1000000
                : typeof value !== "string" ||
                  value.length > 4000 ||
                  (type === "frequency" && !["once", "daily", "always"].includes(value));
          })
        )
          throw new Error("INVALID_REQUEST");
        const stored = JSON.parse(String(current.config));
        if (
          section === "popup" &&
          ["popup_title", "popup_body", "popup_image_url", "popup_button_text", "popup_link"].some(
            (name) => stored[name] !== input.values[name],
          )
        )
          stored.popup_version = Number(stored.popup_version || 0) + 1;
        db.prepare("UPDATE operator_application SET config=? WHERE id=?").run(
          JSON.stringify({ ...stored, ...input.values }),
          id,
        );
        revision = digest(
          JSON.stringify(Object.fromEntries(fields.map(([name]) => [name, input.values[name]]))),
        );
      }
      const result = { ok: true, app: id, requestId: input.requestId, revision };
      event(db, "application.saved", `${id}/${section}`);
      db.prepare(
        "INSERT INTO operator_application_audit(time,app,section,fields,request_id) VALUES(datetime('now'),?,?,?,?)",
      ).run(id, section, JSON.stringify(Object.keys(input.values)), input.requestId);
      db.prepare("INSERT INTO operator_local_operation(id,payload_hash,result) VALUES(?,?,?)").run(
        input.requestId,
        hash,
        JSON.stringify(result),
      );
      return result;
    });
  } finally {
    db.close();
  }
}
export function embeddedPublicConfig(id: string) {
  const db = state();
  try {
    const row = db.prepare("SELECT config FROM operator_application WHERE id=?").get(id);
    if (!row) throw new Error("APPLICATION_NOT_FOUND");
    const c = JSON.parse(String(row.config));
    return {
      app: id,
      ads: Object.fromEntries(names("ads").map(([name]) => [name, c[name]])),
      popup: {
        active: c.popup_active,
        title: c.popup_title,
        body: c.popup_body,
        image_url: c.popup_image_url,
        button_text: c.popup_button_text,
        link: c.popup_link,
        frequency: c.popup_frequency,
        version: Number(c.popup_version || 0),
      },
      announcement: { active: c.announcement_active, text: c.announcement_text },
      maintenance: { active: c.maintenance_mode, text: c.maintenance_text },
      update: {
        latest_version: c.latest_version,
        min_version: c.min_version,
        force: c.force_update,
        url: c.update_url,
      },
      pro: {
        enabled: c.pro_enabled,
        remove_ads: c.pro_remove_ads,
        title: c.pro_title,
        features: String(c.pro_features)
          .split("\n")
          .map((line: string) => line.trim())
          .filter(Boolean),
        monthly_price: c.pro_monthly_price,
        yearly_price: c.pro_yearly_price,
        product_monthly: c.pro_product_monthly,
        product_yearly: c.pro_product_yearly,
        android_key: c.pro_android_key,
        ios_key: c.pro_ios_key,
        entitlement: c.pro_entitlement,
      },
      push_topic: "",
    };
  } finally {
    db.close();
  }
}
