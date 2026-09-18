# Blasphemy Evaluation Framework

The goal is not to maximize the number of findings. The goal is to maximize **useful, evidence-backed findings** while minimizing false positives and redundancy.

## Gold cases

Each website gets a `GoldCase` with manually curated insights. A gold insight is a concept, not an exact sentence. Human reviewers define the important business/SEO/content/UX/technical outcomes that an excellent audit should surface.

Recommended importance levels:

- `must_find`: a material issue/opportunity that should appear in a good audit.
- `valuable`: useful but not essential.
- `nice_to_have`: optional polish.

Each gold insight should include keywords and expected evidence patterns. Evidence patterns are matched against the dossier evidence text passed into the evaluator.

## Offline metrics

### Precision@K

Of the top K candidates shown to the customer, how many match a gold concept strongly enough to count as useful?

### Recall@K

How many gold concepts were discovered among the top K candidates?

### Must-find recall

The most important metric for product quality: fraction of `must_find` concepts detected.

### Evidence accuracy

Do candidate evidence references actually contain evidence supporting the claimed issue?

### Actionability

Does the candidate have a responsible owner, a concrete fix, a verification step, and an affected target?

### False-positive rate

How much of the output is noise, generic advice, unsupported inference, or non-issues?

### Redundancy rate

How much of the output repeats another insight's underlying idea?

### Composite quality score

A balanced internal score combining precision, recall, evidence accuracy, actionability, false-positive rate and redundancy. It is a model-development metric, not a website score and should never be shown to customers.

## Model comparison protocol

For every change to a model, prompt, dossier builder or judge:

1. Run the same Gold Set.
2. Keep crawl limits, dossier version and evaluation K fixed.
3. Record model ID, analyst prompt version, judge prompt version and dossier schema version.
4. Compare must-find recall, precision@K, evidence accuracy and false-positive rate first.
5. Review a random sample of keep/rewrite/drop decisions manually.
6. Reject changes that improve recall by materially increasing unsupported or generic findings.

## Human review loop

For production audits, store:

- audit ID
- candidate/final insight ID
- model and prompt versions
- user vote (`useful` / `not useful`)
- optional reason
- whether the insight was dismissed or acted upon

Use this data first to improve ranking and judging. Only later use it as training/preference data for proprietary models.
