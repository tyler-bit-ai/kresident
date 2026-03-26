import { load } from "cheerio";

import type {
  ArticleAttachments,
  AttachmentCandidate,
  BoardArticle,
} from "../../domain/article";
import { ParsingError } from "../../domain/errors";

function toAbsoluteUrl(baseUrl: string, href: string): string {
  return new URL(href, baseUrl).toString();
}

function extractArticleId(articleUrl: string): string {
  const match = articleUrl.match(/\/(\d+)\/artclView\.do$/);
  if (!match?.[1]) {
    throw new ParsingError(`Unable to extract article id from URL: ${articleUrl}`);
  }

  return match[1];
}

function extractAttachmentId(downloadUrl: string): string {
  const match = downloadUrl.match(/\/(\d+)\/download\.do$/);
  if (!match?.[1]) {
    throw new ParsingError(
      `Unable to extract attachment id from URL: ${downloadUrl}`,
    );
  }

  return match[1];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").replace("새글작성", "").trim();
}

function collectAttachmentDescriptionMap(articleHtml: string): Map<string, string> {
  const rawBlocks = [
    ...articleHtml.matchAll(/<p[^>]*>(.*?)<\/p>/gis),
    ...articleHtml.matchAll(/<li[^>]*>(.*?)<\/li>/gis),
  ];

  const candidates = rawBlocks
    .map((match) =>
      normalizeText(
        (match[1] ?? "")
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " "),
      ),
    )
    .filter((line) => /^\d+\.(hwp|pdf|xls|xlsx)\s*:/.test(line));

  const descriptionMap = new Map<string, string>();
  for (const line of [...new Set(candidates)]) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const fileName = normalizeText(line.slice(0, separatorIndex));
    descriptionMap.set(fileName, line);
  }

  return descriptionMap;
}

export function parseBoardArticles(
  boardHtml: string,
  baseUrl: string,
): BoardArticle[] {
  const $ = load(boardHtml);

  const articles = $("a.artclLinkView")
    .map((_, element) => {
      const anchor = $(element);
      const href = anchor.attr("href");
      const title = normalizeText(anchor.text());

      if (!href || !title) {
        return null;
      }

      const row = anchor.closest("tr");
      const dateCellText = normalizeText(
        row.find("td").eq(row.find("td").length - 2).text(),
      );

      if (!dateCellText) {
        throw new ParsingError(`Unable to extract published date for "${title}"`);
      }

      const articleUrl = toAbsoluteUrl(baseUrl, href);

      return {
        articleId: extractArticleId(articleUrl),
        title,
        publishedAt: dateCellText,
        articleUrl,
      } satisfies BoardArticle;
    })
    .get()
    .filter((article): article is BoardArticle => article !== null);

  if (articles.length === 0) {
    throw new ParsingError(
      "No board articles were parsed. The board HTML structure may have changed.",
    );
  }

  return articles;
}

export function parseTotalPages(boardHtml: string): number {
  const $ = load(boardHtml);
  const totalPagesText = normalizeText($("p._pageState span._totPage").text());
  const totalPages = Number.parseInt(totalPagesText, 10);

  if (Number.isNaN(totalPages) || totalPages <= 0) {
    throw new ParsingError(
      "Unable to determine total page count from the board HTML.",
    );
  }

  return totalPages;
}

export function isMonthlyStatisticsArticle(article: BoardArticle): boolean {
  return article.title.includes("통계월보");
}

export function parseArticleAttachments(
  article: BoardArticle,
  articleHtml: string,
  baseUrl: string,
): ArticleAttachments {
  const $ = load(articleHtml);
  const descriptionMap = collectAttachmentDescriptionMap(articleHtml);

  const attachments = $("dd.artclInsert.fileList a[href$='/download.do']")
    .map((index, element) => {
      const anchor = $(element);
      const href = anchor.attr("href");
      const name = normalizeText(anchor.text());

      if (!href || !name) {
        return null;
      }

      const downloadUrl = toAbsoluteUrl(baseUrl, href);
      const extension = name.includes(".")
        ? name.split(".").pop()?.toLowerCase() ?? ""
        : "";

      const description = descriptionMap.get(name) ?? null;

      return {
        attachmentId: extractAttachmentId(downloadUrl),
        name,
        description,
        downloadUrl,
        extension,
      } satisfies AttachmentCandidate;
    })
    .get()
    .filter((attachment): attachment is AttachmentCandidate => attachment !== null);

  if (attachments.length === 0) {
    throw new ParsingError(
      `No attachments were parsed for article ${article.articleId}. The detail HTML structure may have changed.`,
    );
  }

  return {
    article,
    attachments,
  };
}

export function isEntryStatisticsAttachment(
  attachment: AttachmentCandidate,
): boolean {
  const isExcel = attachment.extension === "xls" || attachment.extension === "xlsx";
  const searchableText = `${attachment.name} ${attachment.description ?? ""}`;

  return isExcel && searchableText.includes("입국자");
}

export function isLegacySecondFileAttachment(
  attachment: AttachmentCandidate,
): boolean {
  const normalizedName = attachment.name.trim().toLowerCase();
  return normalizedName === "2.xls" || normalizedName === "2.xlsx";
}
