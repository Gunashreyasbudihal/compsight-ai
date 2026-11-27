import { AnalystMessage, Competitor, DiffChangeItem } from './types';
import { StorageService } from './services/storageService';
import {
  askCompetitorAnalyst,
  normalizeCompetitorInput,
  researchCompetitorLive,
} from './services/intelligenceService';

export class CompSightApiClient {
  private competitors: Competitor[];

  constructor() {
    this.competitors = StorageService.loadCompetitors();
  }

  async getCompetitors(): Promise<{
    competitors: Competitor[];
    liveApi: boolean;
  }> {
    this.competitors = StorageService.loadCompetitors();
    return { competitors: [...this.competitors], liveApi: true };
  }

  async getCompetitorById(id: string): Promise<Competitor | undefined> {
    return this.competitors.find((c) => c.id === id);
  }

  /**
   * Researches a new or existing competitor via the Full-Internet Intelligence Engine.
   * When re-scanning an existing competitor, runs the Real Diff Engine and logs changes.
   * Throws an explicit error if the live API call fails (zero silent mock fallbacks).
   */
  async analyzeCompetitor(
    rawInput: string,
    forceRescanCompetitor?: Competitor,
  ): Promise<{
    competitor: Competitor;
    isNew: boolean;
    newDiffs: DiffChangeItem[];
  }> {
    const validation = normalizeCompetitorInput(rawInput);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid competitor name or URL.');
    }

    const existing =
      forceRescanCompetitor ||
      this.competitors.find(
        (c) => c.domain.toLowerCase() === validation.domain.toLowerCase(),
      );

    const { competitor, newDiffs } = await researchCompetitorLive(
      rawInput,
      existing,
    );

    this.competitors = StorageService.upsertCompetitor(
      this.competitors,
      competitor,
    );

    return {
      competitor,
      isNew: !existing,
      newDiffs,
    };
  }

  deleteCompetitor(id: string): Competitor[] {
    this.competitors = StorageService.deleteCompetitor(this.competitors, id);
    return [...this.competitors];
  }

  /**
   * Resets the chat thread for a competitor when switching companies so context never bleeds.
   */
  resetCompetitorChatHistory(competitorId: string): Competitor[] {
    const target = this.competitors.find((c) => c.id === competitorId);
    if (target) {
      target.chatHistory = [];
      this.competitors = StorageService.upsertCompetitor(
        this.competitors,
        target,
      );
    }
    return [...this.competitors];
  }

  /**
   * Appends a user message immediately to the active competitor's chat thread before calling the API.
   */
  appendUserMessage(competitorId: string, question: string): AnalystMessage {
    const target = this.competitors.find((c) => c.id === competitorId);
    if (!target) {
      throw new Error('Competitor not found.');
    }
    const trimmed = question.trim();
    const history = Array.isArray(target.chatHistory) ? target.chatHistory : [];
    const lastMsg = history[history.length - 1];
    // Avoid duplicating the user message on Retry
    if (lastMsg && lastMsg.role === 'user' && lastMsg.content === trimmed) {
      return lastMsg;
    }

    const userMsg: AnalystMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: 'Just now',
    };
    target.chatHistory = [...history, userMsg];
    this.competitors = StorageService.upsertCompetitor(
      this.competitors,
      target,
    );
    return userMsg;
  }

  /**
   * Calls the live Gemini AI Analyst endpoint with the competitor's verified JSON dossier,
   * the full conversation history in the drawer, and the exact new user message.
   */
  async askAnalyst(competitorId: string, question: string): Promise<Competitor> {
    const target = this.competitors.find((c) => c.id === competitorId);
    if (!target) {
      throw new Error('Competitor not found.');
    }

    this.appendUserMessage(competitorId, question);

    // Pass prior turns (excluding the just-appended user turn) + the exact new question
    const historyBeforeNewTurn = (target.chatHistory || []).slice(0, -1);
    const answer = await askCompetitorAnalyst(
      target,
      question.trim(),
      historyBeforeNewTurn,
    );

    const assistantMsg: AnalystMessage = {
      id: `msg-a-${Date.now()}`,
      role: 'assistant',
      content: answer,
      timestamp: 'Just now',
    };
    target.chatHistory = [...(target.chatHistory || []), assistantMsg];
    this.competitors = StorageService.upsertCompetitor(
      this.competitors,
      target,
    );
    return target;
  }
}
