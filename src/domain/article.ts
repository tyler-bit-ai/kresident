export interface BoardArticle {
  articleId: string;
  title: string;
  publishedAt: string;
  articleUrl: string;
}

export interface AttachmentCandidate {
  attachmentId: string;
  name: string;
  description: string | null;
  downloadUrl: string;
  extension: string;
}

export interface ArticleAttachments {
  article: BoardArticle;
  attachments: AttachmentCandidate[];
}
