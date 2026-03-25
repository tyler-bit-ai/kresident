import type { ArticleAttachments, BoardArticle } from "../domain/article";
import type { AppConfig } from "../domain/types";
import { fetchTextWithRetry } from "./http/fetch-with-retry";
import {
  isMonthlyStatisticsArticle,
  parseArticleAttachments,
  parseBoardArticles,
  parseTotalPages,
} from "./parsers/immigration-board-parser";

export class ImmigrationBoardClient {
  constructor(private readonly config: AppConfig) {}

  async fetchMonthlyArticles(options: {
    allPages?: boolean;
  } = {}): Promise<BoardArticle[]> {
    const html = await fetchTextWithRetry(this.config.boardUrl, this.config);
    const articles = parseBoardArticles(html, this.config.baseUrl).filter(
      isMonthlyStatisticsArticle,
    );

    if (!options.allPages) {
      return articles;
    }

    const totalPages = parseTotalPages(html);
    const allArticles = [...articles];

    for (let page = 2; page <= totalPages; page += 1) {
      const pageHtml = await this.fetchBoardPage(page);
      const pageArticles = parseBoardArticles(pageHtml, this.config.baseUrl).filter(
        isMonthlyStatisticsArticle,
      );
      allArticles.push(...pageArticles);
    }

    return allArticles;
  }

  async fetchArticleAttachments(article: BoardArticle): Promise<ArticleAttachments> {
    const html = await fetchTextWithRetry(article.articleUrl, this.config);
    return parseArticleAttachments(article, html, this.config.baseUrl);
  }

  private async fetchBoardPage(page: number): Promise<string> {
    return await fetchTextWithRetry(
      `${this.config.baseUrl}/bbs/immigration/${this.config.boardId}/artclList.do`,
      this.config,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          page: String(page),
        }).toString(),
      },
    );
  }
}
