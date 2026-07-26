import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { DomainCode, PolicyAxis, AssessmentLabel } from '../common/enums';

interface MatrixCell {
  domain: DomainCode;
  policyAxis: PolicyAxis;
  label: AssessmentLabel;
  note: string;
}

interface AnalysisResult {
  cells: MatrixCell[];
  summary: string;
}

/**
 * 정책문서 D×P 매트릭스 AI 분석.
 * LLM은 DeepSeek(블루프린트 제4장 LLM_POLICY 결정). DeepSeek는 OpenAI 호환 API라
 * openai SDK에 baseURL만 바꿔 재사용한다(프롬프트·JSON 응답 로직 동일). OPENAI_API_KEY 의존 제거.
 *   - LLM_POLICY_API_KEY  : DeepSeek API 키(필수)
 *   - LLM_POLICY_BASE_URL : 기본 https://api.deepseek.com
 *   - LLM_POLICY_MODEL    : 기본 deepseek-chat
 */
@Injectable()
export class GptAnalysisService {
  private readonly logger = new Logger(GptAnalysisService.name);
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    const key = process.env.LLM_POLICY_API_KEY?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'LLM_POLICY_API_KEY(DeepSeek)가 설정되지 않았습니다. backend/.env를 확인하세요.',
      );
    }
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: key,
        baseURL:
          process.env.LLM_POLICY_BASE_URL?.trim() || 'https://api.deepseek.com',
      });
    }
    return this.client;
  }

  async analyzePolicy(document: {
    title: string;
    summary?: string;
    description?: string;
    country?: string;
    year?: number;
  }): Promise<AnalysisResult> {
    const prompt = this.buildPrompt(document);

    try {
      const response = await this.getClient().chat.completions.create({
        model: process.env.LLM_POLICY_MODEL || 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `당신은 중독 정책 분석 전문가입니다. 정책 문서를 분석하여 D×P 매트릭스를 작성합니다.

도메인 분류:
- D0: 물질중독 (알코올, 니코틴, 마약, 약물)
- D1: 행위중독 (도박, 게임, 쇼핑, 섹스)
- D2: 디지털중독 (SNS, 스마트폰, 인터넷, AI)
- D3: 관계/일중독 (일중독, 관계의존, 공의존)

정책 축:
- P1: 예방/교육 (인식 제고, 학교 교육, 캠페인)
- P2: 조기개입 (스크리닝, 상담, 동기강화)
- P3: 치료/재활 (입원, 외래, 약물치료, 인지행동)
- P4: 사회복귀 (직업훈련, 주거, 사회적응)
- P5: 법/규제 (연령제한, 광고규제, 처벌)
- P6: 재정/인프라 (예산, 시설, 인력)

평가 라벨:
- strong: 해당 영역에 강력한 정책/조치가 있음
- moderate: 어느 정도의 정책/조치가 있음
- weak: 정책/조치가 미흡하거나 부족함
- unclear: 해당 영역에 대한 언급이 없거나 불명확함

반드시 JSON 형식으로만 응답하세요.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      return this.parseResponse(content);
    } catch (error) {
      this.logger.error('GPT 분석 실패:', error);
      throw error;
    }
  }

  private buildPrompt(document: {
    title: string;
    summary?: string;
    description?: string;
    country?: string;
    year?: number;
  }): string {
    return `다음 정책 문서를 분석하여 D×P 매트릭스를 작성해주세요.

제목: ${document.title}
국가: ${document.country || '미상'}
연도: ${document.year || '미상'}
요약: ${document.summary || '없음'}
설명: ${document.description || '없음'}

위 정책 문서가 각 도메인(D0~D3)과 정책축(P1~P6)에 대해 어떤 강도로 다루고 있는지 분석해주세요.

JSON 응답 형식:
{
  "summary": "전체 분석 요약 (한 문장)",
  "cells": [
    {"domain": "D0", "policyAxis": "P1", "label": "strong|moderate|weak|unclear", "note": "근거 설명"},
    {"domain": "D0", "policyAxis": "P2", "label": "...", "note": "..."},
    ...
  ]
}

모든 24개 조합(D0~D3 × P1~P6)에 대해 분석 결과를 포함해주세요.`;
  }

  private parseResponse(content: string): AnalysisResult {
    try {
      const parsed = JSON.parse(content);

      const validDomains = Object.values(DomainCode);
      const validAxes = Object.values(PolicyAxis);
      const validLabels = Object.values(AssessmentLabel);

      const cells: MatrixCell[] = (parsed.cells || [])
        .filter(
          (cell: any) =>
            validDomains.includes(cell.domain) &&
            validAxes.includes(cell.policyAxis) &&
            validLabels.includes(cell.label),
        )
        .map((cell: any) => ({
          domain: cell.domain as DomainCode,
          policyAxis: cell.policyAxis as PolicyAxis,
          label: cell.label as AssessmentLabel,
          note: cell.note || '',
        }));

      return {
        cells,
        summary: parsed.summary || '',
      };
    } catch (error) {
      this.logger.error('GPT 응답 파싱 실패:', content);
      return { cells: [], summary: '' };
    }
  }
}
