import { getTranslations } from 'next-intl/server';

/** 분석실 결과물 하단 명기 (블루프린트 제6장: "Powered by statory") */
export default async function PoweredByStatory() {
  const t = await getTranslations('labPage');
  return (
    <p className="powered-by">
      {t('poweredBy')}{' '}
      <a href="https://statory.org" target="_blank" rel="noopener noreferrer">
        statory
      </a>
    </p>
  );
}
