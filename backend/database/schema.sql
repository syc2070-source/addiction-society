-- 중독사회 데이터베이스 스키마

-- 기본 태그 삽입 (서버 실행 후 테이블 생성되면 실행)
INSERT INTO tags (name, type, description) VALUES
    ('alcohol', 'topic', '알코올'),
    ('drug', 'topic', '약물'),
    ('opioid', 'topic', '오피오이드'),
    ('gambling', 'topic', '도박'),
    ('gaming', 'topic', '게임'),
    ('smartphone', 'topic', '스마트폰'),
    ('sns', 'topic', 'SNS'),
    ('ai', 'topic', 'AI'),
    ('shopping', 'topic', '쇼핑'),
    ('work', 'topic', '일'),
    ('relationship', 'topic', '관계'),
    ('prevention', 'policy', '예방'),
    ('intervention', 'policy', '조기개입'),
    ('treatment', 'policy', '치료'),
    ('rehabilitation', 'policy', '재활'),
    ('regulation', 'policy', '규제'),
    ('funding', 'policy', '재정');