# i-am-visual-thinker

視覚的に考えたい人が、混同しやすい概念の違いを理解するためのSkill。

初期版は「AとBの違いがわからない」という場面を対象にします。同じ構図で二つの概念を比べ、同じ操作を行ったときに結果がどう分かれるかを見せます。その後、別の条件で結果を予想してもらい、理解を確かめます。

## インストール

Node.jsとnpm（npx）が利用できる環境で、導入先のプロジェクトから実行します。

```sh
npx skills add KotaSugiki/i-am-visual-thinker --skill i-am-visual-thinker
```

画面の案内に従って利用するエージェントを選びます。すべてのプロジェクトで使う場合は `-g` を追加します。

インストール前に、配布されているSkillを確認することもできます。

```sh
npx skills add KotaSugiki/i-am-visual-thinker --list
```

オプションの詳細は [Vercel Skills CLIの公式ドキュメント](https://github.com/vercel-labs/skills/blob/main/docs/commands.md#skills-add)を参照してください。

## 初期版の体験

1. 同じ例・配置・記号で二つの概念を比べ、共通点と違いを見つける。
2. 条件を一つ変え、変わった場所と変わらなかった場所を追う。
3. 別の例で結果を予想する。結果を選ぶ、指す、図を直すなどして理解を確かめる。

図の種類を増やすことより、違いが現れる具体例と操作の選び方を重視します。まずは操作前と操作後を静的な図で示す形でも使える設計です。対話的な表示が使える環境では、同じ比較を操作できる形式で示せます。

コードや文書を比較に使う場合は、図の要素や関係の近くに原資料の参照を添えます。資料から読み取れること、実行で観測したこと、推定、未確認の点を区別します。

## 依頼の例

- 「コピーと参照の違いを、片方を書き換えたときの変化で見たい」
- 「平均値と中央値の違いを、一つの値だけ大きくした例で理解したい」
- 「必要条件と十分条件を混同する。具体例を変えながら見分けたい」

## ファイル

```text
.
├── README.md
├── LICENSE
├── AGENTS.md
├── GUIDELINES.md
├── docs/
│   └── skill-update-proposals.md
├── evals/
│   ├── README.md
│   ├── cases.md
│   ├── answer-key.md
│   ├── check_cases.py
│   ├── sources/
│   └── results/
└── skills/
    └── i-am-visual-thinker/
        ├── SKILL.md
        └── references/
            ├── copy-and-reference.md
            └── copy_reference.py
```

- [SKILL.md](skills/i-am-visual-thinker/SKILL.md): Skillの適用条件と説明の進め方。
- [コピーと参照の出力例](skills/i-am-visual-thinker/references/copy-and-reference.md): 同じ配置で比較し、違いが出る操作を示す例。
- [GUIDELINES.md](GUIDELINES.md): 対象者の定義、設計原則、機能追加・改善の判断基準と評価方法。
- [AGENTS.md](AGENTS.md): このリポジトリで作業するAIエージェント向けの指示。
- [改善案](docs/skill-update-proposals.md): 各案の目的、評価方法、採否の条件。
- [評価手順](evals/README.md): 代表課題、採点基準、更新前後の比較方法。

Skill本体と参照資料を、[Skills CLIが検出する `skills/<name>/` 構成](https://github.com/vercel-labs/skills/blob/main/docs/creating-skills.md#skill-discovery)にまとめています。

ローカルで構成を変更した後は、このリポジトリのルートでSkillが検出されるかを確認できます。

```sh
npx skills add . --list
```

理解できたかの目安は説明の図を見直せる状態で、別の例の結果を予想し、違いが生じる箇所を示せることです。特定の認知特性や、すべての利用者に共通する学習方法を前提にせず、本人の反応に合わせて表現を調整します。

## 改善・機能追加の方針

改善や機能追加では、[GUIDELINES.md](GUIDELINES.md)を参照します。正確さ、理解への寄与、負担の軽減、扱いやすさ、見た目の順に判断します。

提案時は第7章に沿って解消したい読解上の問題と改善の仮説を示し、変更後は第8章に沿って評価します。確認結果と未検証の点を記録し、目的や対象範囲を広げる場合は、理由と既存機能への影響も明示します。

代表課題と正答は [evals/](evals/README.md) に置いています。評価資料は開発用で、Skillの配布フォルダとは分けています。教材の正答確認と、人による理解・負担の評価は区別して記録します。
