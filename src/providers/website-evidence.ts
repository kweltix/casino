import type { Source } from "../domain/types";
const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
const contains = (text: string, part: string) =>
  (" " + normalize(text) + " ").includes(" " + normalize(part) + " ");
const canonical = (url: string) => {
  const u = new URL(url);
  u.hash = "";
  return u.href;
};
const directories = [
  "2gis.ru",
  "2gis.com",
  "yandex.ru",
  "yandex.com",
  "maps.yandex.ru",
  "vk.com",
  "t.me",
  "avito.ru",
  "zoon.ru",
  "yell.ru",
];
export function supportsOwnWebsite(
  website: string,
  sources: Source[],
  company: { name: string; address: string; phone?: string },
): boolean {
  const host = new URL(website).hostname;
  if (directories.some((d) => host === d || host.endsWith("." + d)))
    return false;
  return sources.some((s) => {
    if (
      canonical(s.url) !== canonical(website) ||
      !contains(s.excerpt, company.name)
    )
      return false;
    const phone = company.phone?.replace(/\D/g, "") || "";
    const phoneMatch =
      phone.length >= 7 && s.excerpt.replace(/\D/g, "").includes(phone);
    return contains(s.excerpt, company.address) || phoneMatch;
  });
}
