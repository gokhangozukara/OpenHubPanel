import { createHmac } from "node:crypto";
import ipaddr from "ipaddr.js";
import { characters } from "../../features/operator/characters";
import { equal } from "./store";

export function characterHash(value: unknown) {
  if (typeof value !== "string" || !characters.some((character) => character.id === value))
    throw new Error("INVALID_CHARACTER");
  const key = process.env.OPERATOR_KEY;
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error("INVALID_OPERATOR_KEY");
  return createHmac("sha256", Buffer.from(key, "hex")).update(`operator:1:character:${value}`).digest("hex");
}
export function selectedCharacter(hash: string) {
  return characters.find((character) => equal(characterHash(character.id), hash))?.id ?? "";
}
export function username(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 128 ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new Error("INVALID_USERNAME");
  return value.trim().normalize("NFKC");
}
export function normalizedUsername(value: string) {
  return value.normalize("NFKC").toLowerCase();
}
export function clientIp(headers: Headers) {
  const value = headers.get("x-openhub-client-ip") ?? "";
  try {
    return ipaddr.process(value).toString();
  } catch {
    return "unknown";
  }
}
export function parseAllowlist(value: unknown): string[] {
  if (typeof value !== "string" || value.length > 8192) throw new Error("INVALID_IP_RULES");
  const lines = value.split(/[\s,;]+/).filter(Boolean);
  if (lines.length > 64) throw new Error("INVALID_IP_RULES");
  return [
    ...new Set(
      lines.map((line) => {
        try {
          if (line.includes("/")) {
            const [address, bits] = ipaddr.parseCIDR(line);
            return `${address.toString()}/${bits}`;
          }
          return ipaddr.process(line).toString();
        } catch {
          throw new Error("INVALID_IP_RULES");
        }
      }),
    ),
  ];
}
export function allowsIp(rules: string, ip: string) {
  const list: unknown = JSON.parse(rules);
  if (!Array.isArray(list) || list.some((value) => typeof value !== "string"))
    throw new Error("INVALID_IP_RULES");
  if (!list.length) return true;
  try {
    const address = ipaddr.process(ip);
    return list.some((line: string) => {
      if (!line.includes("/")) return ipaddr.process(line).toString() === address.toString();
      const [network, bits] = ipaddr.parseCIDR(line);
      return network.kind() === address.kind() && address.match(network, bits);
    });
  } catch {
    return false;
  }
}
