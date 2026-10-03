//! Exact-match term dictionary applied after transcription.
//!
//! Speech models regularly misspell brand names and technical terms, and they
//! transliterate them into the dictation script ("телеграм", "чат джипити",
//! "github"). The fuzzy custom-word matcher in [`super::text`] cannot fix those:
//! it is ASCII-only and compares against what the user typed, not against the
//! spoken forms. This module maps known spoken/misspelled forms to their
//! canonical spelling with plain hash lookups, so its cost is a handful of
//! small allocations per word and it is safe to run on every dictation.
//!
//! Two sources feed it:
//! - a built-in list (`builtin_terms.txt`) parsed once on first use, and
//! - user rules written as custom words with an arrow, e.g.
//!   `телеграм, телега → Telegram`.

use once_cell::sync::Lazy;
use std::collections::HashMap;

/// Longest alias (in whitespace-separated words) that is considered. Longer
/// aliases are ignored rather than slowing every lookup down.
const MAX_ALIAS_WORDS: usize = 4;

/// Arrow spellings accepted in user rules. `→` is the canonical form stored by
/// the settings UI; the ASCII spellings are accepted for hand-edited settings.
const RULE_ARROWS: &[&str] = &["→", "=>", "->"];

static BUILTIN: Lazy<TermDictionary> =
    Lazy::new(|| TermDictionary::parse(include_str!("builtin_terms.txt")));

/// The built-in brand and terminology dictionary.
pub fn builtin_dictionary() -> &'static TermDictionary {
    &BUILTIN
}

/// Alias key → canonical spelling.
#[derive(Debug, Default)]
pub struct TermDictionary {
    terms: HashMap<String, String>,
    max_words: usize,
}

impl TermDictionary {
    /// Parses `Canonical = alias | alias` lines; lines starting with `#` are
    /// comments. A canonical spelling with distinctive casing is also an alias
    /// of itself, which fixes "github" → "GitHub".
    fn parse(source: &str) -> Self {
        let mut dictionary = Self::default();
        for line in source.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let (canonical, aliases) = match line.split_once('=') {
                Some((canonical, aliases)) => (canonical.trim(), aliases),
                None => (line, ""),
            };
            if canonical.is_empty() {
                continue;
            }
            if has_distinctive_spelling(canonical) {
                dictionary.insert(canonical, canonical);
            }
            for alias in aliases.split('|') {
                dictionary.insert(alias, canonical);
            }
        }
        dictionary
    }

    fn insert(&mut self, alias: &str, canonical: &str) {
        let word_count = alias.split_whitespace().count();
        if word_count == 0 || word_count > MAX_ALIAS_WORDS {
            return;
        }
        let key = term_key(alias);
        if key.is_empty() {
            return;
        }
        self.max_words = self.max_words.max(word_count);
        self.terms.insert(key, canonical.trim().to_string());
    }

    pub fn is_empty(&self) -> bool {
        self.terms.is_empty()
    }

    fn get(&self, key: &str) -> Option<&str> {
        self.terms.get(key).map(String::as_str)
    }
}

/// Custom-word entries split into fuzzy-match targets and exact rules.
pub struct CustomVocabulary {
    /// Plain custom words plus the right-hand side of every rule. These feed
    /// the fuzzy matcher and the Whisper decode prompt.
    pub terms: Vec<String>,
    /// Exact `alias → replacement` rules.
    pub rules: TermDictionary,
}

/// Splits user custom words into plain terms and `alias → replacement` rules.
/// Several aliases may share one rule when separated by commas.
pub fn parse_custom_vocabulary(entries: &[String]) -> CustomVocabulary {
    let mut terms = Vec::with_capacity(entries.len());
    let mut rules = TermDictionary::default();

    for entry in entries {
        match split_rule(entry) {
            Some((aliases, replacement)) => {
                for alias in aliases.split(',') {
                    rules.insert(alias, replacement);
                }
                if !terms.iter().any(|term| term == replacement) {
                    terms.push(replacement.to_string());
                }
            }
            None => {
                let term = entry.trim();
                if !term.is_empty() {
                    terms.push(term.to_string());
                }
            }
        }
    }

    CustomVocabulary { terms, rules }
}

fn split_rule(entry: &str) -> Option<(&str, &str)> {
    RULE_ARROWS.iter().find_map(|arrow| {
        let (aliases, replacement) = entry.split_once(arrow)?;
        let replacement = replacement.trim();
        (!aliases.trim().is_empty() && !replacement.is_empty()).then_some((aliases, replacement))
    })
}

/// Whether matching a canonical spelling against itself is safe. Plainly
/// capitalized names ("Word", "Teams", "Apple") are ordinary words too, and
/// keys under three characters ("C#" → "c") would capture single letters, so
/// only spellings with inner capitals or symbols qualify ("GitHub", "iPhone",
/// "Node.js", "API").
fn has_distinctive_spelling(canonical: &str) -> bool {
    term_key(canonical).chars().count() >= 3
        && canonical.split_whitespace().any(|word| {
            word.chars().skip(1).any(char::is_uppercase)
                || word.chars().any(|c| !c.is_alphanumeric())
        })
}

/// Lowercased alphanumerics only, with `ё` folded into `е` so both spellings
/// of a Russian transliteration share a key.
fn term_key(text: &str) -> String {
    text.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .map(|c| if c == 'ё' { 'е' } else { c })
        .collect()
}

/// Splits a whitespace token into leading punctuation, core and trailing
/// punctuation using char boundaries.
fn split_token(token: &str) -> (&str, &str, &str) {
    let start = token
        .char_indices()
        .find(|(_, c)| c.is_alphanumeric())
        .map(|(index, _)| index)
        .unwrap_or(token.len());
    let end = token
        .char_indices()
        .rev()
        .find(|(_, c)| c.is_alphanumeric())
        .map(|(index, c)| index + c.len_utf8())
        .unwrap_or(start);
    (
        &token[..start],
        &token[start..end.max(start)],
        &token[end.max(start)..],
    )
}

/// Replaces dictionary aliases in `text` with their canonical spelling.
///
/// Dictionaries are consulted in order, so user rules passed first win over
/// the built-in list. At each position the longest alias wins, and a match
/// never spans punctuation ("Charge, B" stays two words). Text without any
/// match is returned unchanged, including its original whitespace.
pub fn apply_term_dictionaries(text: &str, dictionaries: &[&TermDictionary]) -> String {
    let max_words = dictionaries
        .iter()
        .map(|dictionary| dictionary.max_words)
        .max()
        .unwrap_or(0);
    if max_words == 0 {
        return text.to_string();
    }

    let tokens: Vec<&str> = text.split_whitespace().collect();
    let mut output: Vec<String> = Vec::with_capacity(tokens.len());
    let mut changed = false;
    let mut key = String::new();
    let mut i = 0;

    while i < tokens.len() {
        let mut matched: Option<(usize, &str)> = None;
        let longest = max_words.min(tokens.len() - i);

        'lengths: for n in (1..=longest).rev() {
            key.clear();
            for (offset, token) in tokens[i..i + n].iter().enumerate() {
                let (prefix, core, suffix) = split_token(token);
                let first = offset == 0;
                let last = offset == n - 1;
                if core.is_empty()
                    || (!first && !prefix.is_empty())
                    || (!last && !suffix.is_empty())
                {
                    continue 'lengths;
                }
                key.push_str(&term_key(core));
            }
            if let Some(canonical) = dictionaries.iter().find_map(|d| d.get(&key)) {
                matched = Some((n, canonical));
                break;
            }
        }

        match matched {
            Some((n, canonical)) => {
                let (prefix, _, _) = split_token(tokens[i]);
                let (_, _, suffix) = split_token(tokens[i + n - 1]);
                let replacement = format!("{prefix}{canonical}{suffix}");
                if n > 1 || replacement != tokens[i] {
                    changed = true;
                }
                output.push(replacement);
                i += n;
            }
            None => {
                output.push(tokens[i].to_string());
                i += 1;
            }
        }
    }

    if changed {
        output.join(" ")
    } else {
        text.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn builtin(text: &str) -> String {
        apply_term_dictionaries(text, &[builtin_dictionary()])
    }

    #[test]
    fn builtin_dictionary_parses() {
        assert!(!builtin_dictionary().is_empty());
        assert!(builtin_dictionary().max_words >= 2);
    }

    #[test]
    fn fixes_russian_transliterations() {
        assert_eq!(
            builtin("напиши мне в телеграм, а код залей на гитхаб."),
            "напиши мне в Telegram, а код залей на GitHub."
        );
        assert_eq!(builtin("спроси у чат джипити"), "спроси у ChatGPT");
        assert_eq!(builtin("Чат-джипити ответил"), "ChatGPT ответил");
    }

    #[test]
    fn fixes_latin_casing() {
        assert_eq!(
            builtin("I pushed the javascript to github"),
            "I pushed the JavaScript to GitHub"
        );
        assert_eq!(builtin("open vs code"), "open VS Code");
        assert_eq!(builtin("node js and next js"), "Node.js and Next.js");
    }

    #[test]
    fn yo_is_folded() {
        assert_eq!(builtin("в ютьюбе"), "в YouTube");
    }

    #[test]
    fn match_does_not_span_punctuation() {
        assert_eq!(builtin("чат, джипити"), "чат, GPT");
    }

    #[test]
    fn untouched_text_keeps_whitespace() {
        let text = "обычный  текст без терминов";
        assert_eq!(builtin(text), text);
    }

    #[test]
    fn ordinary_words_are_not_replaced() {
        let text = "пришла телеграмма, питон уполз, курсор мигает";
        assert_eq!(builtin(text), text);
    }

    #[test]
    fn user_rules_take_precedence_and_feed_terms() {
        let vocabulary = parse_custom_vocabulary(&[
            "UXO".to_string(),
            "юксо, ю икс о → UXO".to_string(),
            "гитхаб -> GitHub Enterprise".to_string(),
        ]);
        assert_eq!(vocabulary.terms, vec!["UXO", "GitHub Enterprise"]);
        let result = apply_term_dictionaries(
            "открой ю икс о и гитхаб",
            &[&vocabulary.rules, builtin_dictionary()],
        );
        assert_eq!(result, "открой UXO и GitHub Enterprise");
    }

    #[test]
    fn malformed_rules_are_plain_terms() {
        let vocabulary = parse_custom_vocabulary(&["→ UXO".to_string(), "UXO →".to_string()]);
        assert_eq!(vocabulary.terms, vec!["→ UXO", "UXO →"]);
        assert!(vocabulary.rules.is_empty());
    }
}
