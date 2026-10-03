//! Context-aware conversion of spelled-out numbers to digits.
//!
//! Many speech models (Parakeet, GigaAM, and Whisper at times) write numbers
//! as words: "плюс семь девятьсот шестнадцать ...", "двадцать пятого марта",
//! "сто двадцать рублей". This pass rewrites them the way people type them,
//! but only where the context implies digits:
//!
//! - phone numbers: a run of number groups after a keyword ("телефон",
//!   "номер", "phone"), a leading "плюс"/"plus", or three or more groups;
//! - dates: a day ordinal before a month ("25 марта") or "числа";
//! - years: a 4-digit ordinal before "год"/"года"/... ("2026 года");
//! - quantities: any cardinal of 10 or more, and any cardinal before a unit
//!   ("5 километров", "0 градусов").
//!
//! Small standalone numbers ("два варианта", "one idea") and ordinals outside
//! dates ("второй вопрос") stay as words, matching common style guides.
//! Lexicons exist for Russian and English; other languages pass through.

use once_cell::sync::Lazy;
use std::collections::{HashMap, HashSet};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Class {
    Zero,
    /// 1–9 (and standalone ordinals such as "двухтысячный").
    Unit,
    /// 10–19, and English hyphenated 21–99 ("twenty-five").
    Teen,
    /// 20, 30, ... 90.
    Ten,
    /// Russian 100–900 words ("сто", "двести").
    Hundred,
    /// English "hundred": multiplies the preceding unit.
    HundredMultiplier,
    /// thousand, million, billion.
    Scale,
}

#[derive(Clone, Copy, Debug)]
struct NumberWord {
    value: u64,
    class: Class,
    ordinal: bool,
}

struct Lexicon {
    words: HashMap<String, NumberWord>,
    months: HashSet<String>,
    day_words: HashSet<String>,
    year_words: HashSet<String>,
    unit_prefixes: Vec<&'static str>,
    phone_keywords: Vec<&'static str>,
    plus_words: HashSet<String>,
    /// Thousands separator for values of 10 000 and more.
    thousands_separator: &'static str,
}

impl Lexicon {
    fn new(thousands_separator: &'static str) -> Self {
        Self {
            words: HashMap::new(),
            months: HashSet::new(),
            day_words: HashSet::new(),
            year_words: HashSet::new(),
            unit_prefixes: Vec::new(),
            phone_keywords: Vec::new(),
            plus_words: HashSet::new(),
            thousands_separator,
        }
    }

    fn add(&mut self, forms: &str, value: u64, class: Class, ordinal: bool) {
        for form in forms.split_whitespace() {
            self.words.insert(
                fold(form),
                NumberWord {
                    value,
                    class,
                    ordinal,
                },
            );
        }
    }

    /// Russian ordinal adjective forms from a stem ("пят" → "пятый",
    /// "пятого", "пятому", ...).
    fn add_ru_ordinal(&mut self, stem: &str, value: u64, class: Class) {
        for ending in [
            "ый", "ой", "ого", "ому", "ым", "ом", "ая", "ую", "ое", "ые", "ых", "ыми",
        ] {
            self.add(&format!("{stem}{ending}"), value, class, true);
        }
    }

    fn set(target: &mut HashSet<String>, words: &str) {
        target.extend(words.split_whitespace().map(fold));
    }

    fn is_unit(&self, word: &str) -> bool {
        self.unit_prefixes
            .iter()
            .any(|prefix| word.starts_with(prefix))
    }
}

/// Lowercase with `ё` folded into `е`.
fn fold(word: &str) -> String {
    word.chars()
        .flat_map(char::to_lowercase)
        .map(|c| if c == 'ё' { 'е' } else { c })
        .collect()
}

static RUSSIAN: Lazy<Lexicon> = Lazy::new(|| {
    use Class::*;
    let mut lx = Lexicon::new(" ");

    lx.add("ноль нуль ноля нуля нолю нулю нолем нулем", 0, Zero, false);
    lx.add(
        "один одна одно одного одной одному одним одном одну",
        1,
        Unit,
        false,
    );
    lx.add("два две двух двум двумя", 2, Unit, false);
    lx.add("три трех трем тремя", 3, Unit, false);
    lx.add("четыре четырех четырем четырьмя", 4, Unit, false);
    for (value, nominative, oblique, instrumental) in [
        (5, "пять", "пяти", "пятью"),
        (6, "шесть", "шести", "шестью"),
        (7, "семь", "семи", "семью"),
        (8, "восемь", "восьми", "восемью восьмью"),
        (9, "девять", "девяти", "девятью"),
    ] {
        lx.add(
            &format!("{nominative} {oblique} {instrumental}"),
            value,
            Unit,
            false,
        );
    }
    for (value, stem) in [
        (10, "десят"),
        (11, "одиннадцат"),
        (12, "двенадцат"),
        (13, "тринадцат"),
        (14, "четырнадцат"),
        (15, "пятнадцат"),
        (16, "шестнадцат"),
        (17, "семнадцат"),
        (18, "восемнадцат"),
        (19, "девятнадцат"),
    ] {
        lx.add(&format!("{stem}ь {stem}и {stem}ью"), value, Teen, false);
    }
    lx.add("двадцать двадцати двадцатью", 20, Ten, false);
    lx.add("тридцать тридцати тридцатью", 30, Ten, false);
    lx.add("сорок сорока", 40, Ten, false);
    lx.add("пятьдесят пятидесяти пятьюдесятью", 50, Ten, false);
    lx.add("шестьдесят шестидесяти шестьюдесятью", 60, Ten, false);
    lx.add("семьдесят семидесяти семьюдесятью", 70, Ten, false);
    lx.add("восемьдесят восьмидесяти восемьюдесятью", 80, Ten, false);
    lx.add("девяносто девяноста", 90, Ten, false);
    lx.add("сто ста", 100, Hundred, false);
    lx.add(
        "двести двухсот двумстам двумястами двухстах",
        200,
        Hundred,
        false,
    );
    lx.add(
        "триста трехсот тремстам тремястами трехстах",
        300,
        Hundred,
        false,
    );
    lx.add(
        "четыреста четырехсот четыремстам четырьмястами четырехстах",
        400,
        Hundred,
        false,
    );
    for (value, nominative, stem, instrumental) in [
        (500, "пятьсот", "пят", "пятьюстами"),
        (600, "шестьсот", "шест", "шестьюстами"),
        (700, "семьсот", "сем", "семьюстами"),
        (800, "восемьсот", "восьм", "восемьюстами"),
        (900, "девятьсот", "девят", "девятьюстами"),
    ] {
        lx.add(
            &format!("{nominative} {stem}исот {stem}истам {stem}истах {instrumental}"),
            value,
            Hundred,
            false,
        );
    }
    lx.add(
        "тысяча тысячи тысяч тысячу тысячей тысячею тысячам тысячами тысячах",
        1_000,
        Scale,
        false,
    );
    lx.add(
        "миллион миллиона миллионов миллиону миллионом миллионам миллионами миллионах",
        1_000_000,
        Scale,
        false,
    );
    lx.add(
        "миллиард миллиарда миллиардов миллиарду миллиардом миллиардам миллиардами миллиардах",
        1_000_000_000,
        Scale,
        false,
    );

    // Ordinals (dates and years).
    lx.add_ru_ordinal("перв", 1, Unit);
    lx.add_ru_ordinal("втор", 2, Unit);
    lx.add(
        "третий третьего третьему третьим третьем третья третьей третью третье третьи третьих третьими",
        3,
        Unit,
        true,
    );
    lx.add_ru_ordinal("четверт", 4, Unit);
    lx.add_ru_ordinal("пят", 5, Unit);
    lx.add_ru_ordinal("шест", 6, Unit);
    lx.add_ru_ordinal("седьм", 7, Unit);
    lx.add_ru_ordinal("восьм", 8, Unit);
    lx.add_ru_ordinal("девят", 9, Unit);
    for (value, stem) in [
        (10, "десят"),
        (11, "одиннадцат"),
        (12, "двенадцат"),
        (13, "тринадцат"),
        (14, "четырнадцат"),
        (15, "пятнадцат"),
        (16, "шестнадцат"),
        (17, "семнадцат"),
        (18, "восемнадцат"),
        (19, "девятнадцат"),
    ] {
        lx.add_ru_ordinal(stem, value, Teen);
    }
    for (value, stem) in [
        (20, "двадцат"),
        (30, "тридцат"),
        (40, "сороков"),
        (50, "пятидесят"),
        (60, "шестидесят"),
        (70, "семидесят"),
        (80, "восьмидесят"),
        (90, "девяност"),
    ] {
        lx.add_ru_ordinal(stem, value, Ten);
    }
    for (value, stem) in [
        (100, "сот"),
        (200, "двухсот"),
        (300, "трехсот"),
        (400, "четырехсот"),
        (500, "пятисот"),
        (600, "шестисот"),
        (700, "семисот"),
        (800, "восьмисот"),
        (900, "девятисот"),
    ] {
        lx.add_ru_ordinal(stem, value, Hundred);
    }
    lx.add_ru_ordinal("тысячн", 1_000, Unit);
    lx.add_ru_ordinal("двухтысячн", 2_000, Unit);

    Lexicon::set(
        &mut lx.months,
        "января февраля марта апреля мая июня июля августа сентября октября ноября декабря",
    );
    Lexicon::set(&mut lx.day_words, "числа число числу");
    Lexicon::set(&mut lx.year_words, "год года году годом годе годах годов");
    Lexicon::set(&mut lx.plus_words, "плюс");
    lx.unit_prefixes = vec![
        "процент",
        "рубл",
        "руб",
        "копе",
        "доллар",
        "евро",
        "юан",
        "тенге",
        "гривн",
        "фунт",
        "километр",
        "км",
        "метр",
        "сантиметр",
        "см",
        "миллиметр",
        "мм",
        "килограмм",
        "кг",
        "грамм",
        "тонн",
        "литр",
        "миллилитр",
        "градус",
        "секунд",
        "минут",
        "час",
        "сут",
        "дн",
        "день",
        "недел",
        "месяц",
        "лет",
        "год",
        "гигабайт",
        "мегабайт",
        "килобайт",
        "терабайт",
        "байт",
        "бит",
        "гб",
        "мб",
        "тб",
        "кб",
        "гц",
        "герц",
        "ватт",
        "вт",
        "вольт",
        "ампер",
        "пиксел",
        "страниц",
        "штук",
        "балл",
        "очк",
        "этаж",
        "квартал",
        "номер",
        "версии",
    ];
    lx.phone_keywords = vec![
        "телефон",
        "номер",
        "позвон",
        "звон",
        "набер",
        "набир",
        "мобильн",
        "сотов",
        "контакт",
        "whatsapp",
        "telegram",
    ];
    lx
});

static ENGLISH: Lazy<Lexicon> = Lazy::new(|| {
    use Class::*;
    let mut lx = Lexicon::new(",");
    let units = [
        "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    ];
    let unit_ordinals = [
        "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth",
    ];
    lx.add("zero", 0, Zero, false);
    for (index, word) in units.iter().enumerate() {
        lx.add(word, index as u64 + 1, Unit, false);
    }
    // "second" is too often the time unit or "the second item"; it only
    // counts as a number inside a date, where the parser asks for ordinals.
    for (index, word) in unit_ordinals.iter().enumerate() {
        lx.add(word, index as u64 + 1, Unit, true);
    }
    for (value, word, ordinal) in [
        (10, "ten", "tenth"),
        (11, "eleven", "eleventh"),
        (12, "twelve", "twelfth"),
        (13, "thirteen", "thirteenth"),
        (14, "fourteen", "fourteenth"),
        (15, "fifteen", "fifteenth"),
        (16, "sixteen", "sixteenth"),
        (17, "seventeen", "seventeenth"),
        (18, "eighteen", "eighteenth"),
        (19, "nineteen", "nineteenth"),
    ] {
        lx.add(word, value, Teen, false);
        lx.add(ordinal, value, Teen, true);
    }
    for (value, word, ordinal) in [
        (20, "twenty", "twentieth"),
        (30, "thirty", "thirtieth"),
        (40, "forty", "fortieth"),
        (50, "fifty", "fiftieth"),
        (60, "sixty", "sixtieth"),
        (70, "seventy", "seventieth"),
        (80, "eighty", "eightieth"),
        (90, "ninety", "ninetieth"),
    ] {
        lx.add(word, value, Ten, false);
        lx.add(ordinal, value, Ten, true);
        for (index, unit) in units.iter().enumerate() {
            let combined = value + index as u64 + 1;
            lx.add(&format!("{word}-{unit}"), combined, Teen, false);
            lx.add(
                &format!("{word}-{}", unit_ordinals[index]),
                combined,
                Teen,
                true,
            );
        }
    }
    lx.add("hundred", 100, HundredMultiplier, false);
    lx.add("thousand", 1_000, Scale, false);
    lx.add("million", 1_000_000, Scale, false);
    lx.add("billion", 1_000_000_000, Scale, false);

    Lexicon::set(
        &mut lx.months,
        "january february march april may june july august september october november december",
    );
    Lexicon::set(&mut lx.year_words, "");
    Lexicon::set(&mut lx.plus_words, "plus");
    lx.unit_prefixes = vec![
        "percent",
        "dollar",
        "euro",
        "pound",
        "cent",
        "kilometer",
        "kilometre",
        "meter",
        "metre",
        "centimeter",
        "millimeter",
        "mile",
        "feet",
        "foot",
        "inch",
        "kilogram",
        "gram",
        "kg",
        "liter",
        "litre",
        "degree",
        "second",
        "minute",
        "hour",
        "day",
        "week",
        "month",
        "year",
        "gigabyte",
        "megabyte",
        "kilobyte",
        "terabyte",
        "byte",
        "gb",
        "mb",
        "tb",
        "pixel",
        "page",
        "point",
        "times",
        "%",
    ];
    lx.phone_keywords = vec![
        "phone", "number", "call", "dial", "cell", "mobile", "whatsapp", "telegram",
    ];
    lx
});

/// Splits a whitespace token into leading punctuation, core, trailing
/// punctuation. Inner hyphens stay in the core ("twenty-five").
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
        .unwrap_or(start)
        .max(start);
    (&token[..start], &token[start..end], &token[end..])
}

#[derive(Debug, Clone, Copy)]
struct ParsedNumber {
    /// Index one past the last token of the number.
    end: usize,
    value: u64,
    ordinal: bool,
    /// The number is a lone "ноль"/"zero".
    zero_word: bool,
    /// The last word was a scale (thousand/million), e.g. "три миллиона".
    ends_with_scale: Option<u64>,
    /// The last token carried trailing punctuation.
    closed: bool,
}

/// Parses the longest well-formed number starting at `start`.
fn parse_number(
    cores: &[String],
    suffixes: &[bool],
    prefixes: &[bool],
    start: usize,
    lx: &Lexicon,
) -> Option<ParsedNumber> {
    let first = lx.words.get(&cores[start])?;
    // "a hundred" is not a number on its own, and a bare scale word
    // ("миллион причин", "тысяча извинений") stays a word; "тысяча девятьсот"
    // is checked after parsing.
    if first.class == Class::HundredMultiplier {
        return None;
    }
    let starts_with_scale = first.class == Class::Scale;

    let mut total: u64 = 0;
    let mut current: u64 = 0;
    let mut last: Option<Class> = None;
    let mut last_scale = u64::MAX;
    let mut index = start;
    let mut parsed: Option<ParsedNumber> = None;

    while index < cores.len() {
        if index > start && prefixes[index] {
            break;
        }
        let Some(word) = lx.words.get(&cores[index]) else {
            break;
        };

        let accepted = match word.class {
            Class::Zero => index == start,
            Class::Unit => matches!(last, None | Some(Class::Ten | Class::Hundred)),
            Class::Teen => matches!(last, None | Some(Class::Hundred)),
            Class::Ten => matches!(last, None | Some(Class::Hundred)),
            Class::Hundred => last.is_none() && current == 0,
            Class::HundredMultiplier => {
                matches!(last, Some(Class::Unit)) && current < 10 && !word.ordinal
            }
            Class::Scale => {
                (current > 0 || last.is_some() || index == start)
                    && word.value < last_scale
                    && !word.ordinal
            }
        };
        if !accepted {
            break;
        }

        let mut ends_with_scale = None;
        match word.class {
            Class::Scale => {
                total += current.max(1) * word.value;
                current = 0;
                last = None;
                last_scale = word.value;
                ends_with_scale = Some(word.value);
            }
            Class::HundredMultiplier => {
                current *= 100;
                last = Some(Class::Hundred);
            }
            class => {
                current += word.value;
                last = Some(class);
            }
        }

        index += 1;
        parsed = Some(ParsedNumber {
            end: index,
            value: total + current,
            ordinal: word.ordinal,
            zero_word: word.class == Class::Zero,
            ends_with_scale,
            closed: suffixes[index - 1],
        });

        if word.ordinal || word.class == Class::Zero || suffixes[index - 1] {
            break;
        }
    }

    parsed.filter(|parsed| !(starts_with_scale && parsed.end == start + 1))
}

fn group_thousands(value: u64, separator: &str) -> String {
    let digits = value.to_string();
    if value < 10_000 {
        return digits;
    }
    let mut out = String::with_capacity(digits.len() + digits.len() / 3);
    for (index, digit) in digits.chars().enumerate() {
        if index > 0 && (digits.len() - index).is_multiple_of(3) {
            out.push_str(separator);
        }
        out.push(digit);
    }
    out
}

fn format_phone(plus: bool, groups: &[String]) -> String {
    let digits: String = groups.concat();
    let single_digits = groups.iter().all(|group| group.len() == 1);

    if digits.len() == 11
        && ((plus && digits.starts_with('7')) || (!plus && digits.starts_with('8')))
    {
        let prefix = if plus { "+" } else { "" };
        return format!(
            "{prefix}{} {} {}-{}-{}",
            &digits[..1],
            &digits[1..4],
            &digits[4..7],
            &digits[7..9],
            &digits[9..]
        );
    }

    let body = if single_digits {
        match digits.len() {
            10 => format!("{}-{}-{}", &digits[..3], &digits[3..6], &digits[6..]),
            7 => format!("{}-{}", &digits[..3], &digits[3..]),
            _ => digits,
        }
    } else {
        groups.join("-")
    };
    if plus {
        format!("+{body}")
    } else {
        body
    }
}

fn lexicon_for(language: Option<&str>, text: &str) -> Option<&'static Lexicon> {
    let base = language.map(|code| {
        code.split(['-', '_'])
            .next()
            .unwrap_or(code)
            .to_ascii_lowercase()
    });
    match base.as_deref() {
        Some("ru") => Some(&RUSSIAN),
        Some("en") => Some(&ENGLISH),
        // Without language evidence only the Russian lexicon is safe to
        // apply: its words are Cyrillic and cannot collide with Latin text.
        None if text.chars().any(|c| matches!(c, '\u{0400}'..='\u{04FF}')) => Some(&RUSSIAN),
        _ => None,
    }
}

/// Rewrites spelled-out numbers as digits where the context implies digits.
/// `language` is the transcription output language, if known.
pub fn numbers_to_digits(text: &str, language: Option<&str>) -> String {
    let Some(lx) = lexicon_for(language, text) else {
        return text.to_string();
    };

    let tokens: Vec<&str> = text.split_whitespace().collect();
    let split: Vec<(&str, &str, &str)> = tokens.iter().map(|token| split_token(token)).collect();
    let cores: Vec<String> = split.iter().map(|(_, core, _)| fold(core)).collect();
    // Fast path: no number word at all.
    if !cores.iter().any(|core| lx.words.contains_key(core)) {
        return text.to_string();
    }
    let prefixes: Vec<bool> = split
        .iter()
        .map(|(prefix, _, _)| !prefix.is_empty())
        .collect();
    let suffixes: Vec<bool> = split
        .iter()
        .map(|(_, _, suffix)| !suffix.is_empty())
        .collect();

    let mut output: Vec<String> = Vec::with_capacity(tokens.len());
    let mut changed = false;
    let mut i = 0;

    let replace = |output: &mut Vec<String>, start: usize, end: usize, text: String| {
        let prefix = split[start].0;
        let suffix = split[end - 1].2;
        output.push(format!("{prefix}{text}{suffix}"));
    };

    while i < tokens.len() {
        // --- Phone numbers -------------------------------------------------
        let plus = lx.plus_words.contains(&cores[i]) && !suffixes[i];
        let digits_start = if plus { i + 1 } else { i };
        let keyword_before = (i.saturating_sub(3)..i).any(|k| {
            lx.phone_keywords
                .iter()
                .any(|keyword| cores[k].starts_with(keyword))
        });
        if digits_start < tokens.len() {
            let mut groups: Vec<String> = Vec::new();
            let mut j = digits_start;
            while j < tokens.len() {
                if j > digits_start && prefixes[j] {
                    break;
                }
                let Some(number) = parse_number(&cores, &suffixes, &prefixes, j, lx) else {
                    break;
                };
                if number.ordinal || number.ends_with_scale.is_some() {
                    break;
                }
                groups.push(number.value.to_string());
                j = number.end;
                // Commas and hyphens may separate groups; anything else
                // (a period, a question mark) ends the phone number.
                let suffix = split[j - 1].2;
                if number.closed && !matches!(suffix, "," | "-") {
                    break;
                }
            }
            let digit_count: usize = groups.iter().map(String::len).sum();
            let is_phone = groups.len() >= 2
                && (7..=15).contains(&digit_count)
                && (plus || keyword_before || groups.len() >= 3);
            if is_phone {
                let start = i;
                let formatted = format_phone(plus, &groups);
                let last_suffix = split[j - 1].2;
                let suffix = if matches!(last_suffix, "," | "-") {
                    ""
                } else {
                    last_suffix
                };
                output.push(format!("{}{}{}", split[start].0, formatted, suffix));
                changed = true;
                i = j;
                continue;
            }
        }

        let Some(number) = parse_number(&cores, &suffixes, &prefixes, i, lx) else {
            output.push(tokens[i].to_string());
            i += 1;
            continue;
        };
        let next =
            (!number.closed && number.end < tokens.len()).then(|| cores[number.end].as_str());
        let previous = i.checked_sub(1).map(|k| cores[k].as_str());

        let digits = if number.ordinal {
            let is_day = (1..=31).contains(&number.value)
                && (next.is_some_and(|word| lx.months.contains(word) || lx.day_words.contains(word))
                    // English "March twenty-fifth"
                    || (lx.year_words.is_empty() && previous.is_some_and(|word| lx.months.contains(word))));
            let is_year = (1_000..=2_999).contains(&number.value)
                && next.is_some_and(|word| lx.year_words.contains(word));
            (is_day || is_year).then(|| number.value.to_string())
        } else if number.zero_word {
            next.is_some_and(|word| lx.is_unit(word))
                .then(|| "0".to_string())
        } else {
            let english_date = lx.year_words.is_empty()
                && (1..=31).contains(&number.value)
                && previous.is_some_and(|word| lx.months.contains(word));
            let wanted =
                number.value >= 10 || english_date || next.is_some_and(|word| lx.is_unit(word));
            wanted.then(|| match number.ends_with_scale {
                // "три миллиона" → "3 миллиона": keep the scale word.
                Some(scale) if scale >= 1_000_000 && number.value.is_multiple_of(scale) => {
                    let last = split[number.end - 1].1;
                    format!(
                        "{} {}",
                        group_thousands(number.value / scale, lx.thousands_separator),
                        last
                    )
                }
                _ => group_thousands(number.value, lx.thousands_separator),
            })
        };

        match digits {
            Some(digits) => {
                replace(&mut output, i, number.end, digits);
                changed = true;
            }
            None => output.extend(tokens[i..number.end].iter().map(|t| t.to_string())),
        }
        i = number.end;
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

    fn ru(text: &str) -> String {
        numbers_to_digits(text, Some("ru"))
    }

    fn en(text: &str) -> String {
        numbers_to_digits(text, Some("en"))
    }

    #[test]
    fn russian_dates() {
        assert_eq!(ru("встреча двадцать пятого марта"), "встреча 25 марта");
        assert_eq!(ru("сегодня первое мая."), "сегодня 1 мая.");
        assert_eq!(
            ru("родился третьего января тысяча девятьсот девяносто восьмого года"),
            "родился 3 января 1998 года"
        );
        assert_eq!(ru("в две тысячи двадцать шестом году"), "в 2026 году");
        assert_eq!(ru("до пятнадцатого числа"), "до 15 числа");
        assert_eq!(ru("Тридцать первого декабря"), "31 декабря");
    }

    #[test]
    fn russian_phone_numbers() {
        assert_eq!(
            ru("мой телефон плюс семь девятьсот шестнадцать сто двадцать три сорок пять шестьдесят семь"),
            "мой телефон +7 916 123-45-67"
        );
        assert_eq!(
            ru("позвони на восемь восемьсот пятьсот пятьдесят пять тридцать пять тридцать пять."),
            "позвони на 8 800 555-35-35."
        );
        assert_eq!(
            ru("номер сто двадцать три, сорок пять, шестьдесят семь"),
            "номер 123-45-67"
        );
        assert_eq!(
            ru("код города четыре девять пять, номер один два три четыре пять шесть семь"),
            "код города четыре девять пять, номер 123-4567"
        );
    }

    #[test]
    fn russian_quantities() {
        assert_eq!(
            ru("это стоит сто двадцать пять рублей"),
            "это стоит 125 рублей"
        );
        assert_eq!(ru("пять километров пешком"), "5 километров пешком");
        assert_eq!(ru("около двадцати человек"), "около 20 человек");
        assert_eq!(ru("ноль градусов"), "0 градусов");
        assert_eq!(ru("три миллиона пользователей"), "3 миллиона пользователей");
        assert_eq!(ru("пятнадцать тысяч триста"), "15 300");
        assert_eq!(ru("две тысячи двадцать шесть"), "2026");
    }

    #[test]
    fn russian_words_that_stay_words() {
        for text in [
            "у нас два варианта",
            "один из них",
            "второй вопрос важнее",
            "миллион причин",
            "сто",
            "Тысяча извинений",
        ] {
            let expected = if text == "сто" { "100" } else { text };
            assert_eq!(ru(text), expected, "{text}");
        }
    }

    #[test]
    fn separate_numbers_are_not_merged() {
        // "два три" is two numbers, not five.
        assert_eq!(ru("варианты два три"), "варианты два три");
        assert_eq!(ru("двадцать пять тридцать"), "25 30");
    }

    #[test]
    fn english_numbers() {
        assert_eq!(en("it costs twenty-five dollars"), "it costs 25 dollars");
        assert_eq!(en("two hundred and fifty"), "200 and 50");
        assert_eq!(en("two hundred fifty people"), "250 people");
        assert_eq!(en("see you March twenty-fifth"), "see you March 25");
        assert_eq!(en("three ideas"), "three ideas");
        assert_eq!(en("wait a second"), "wait a second");
        assert_eq!(
            en("call me at five five five one two three four"),
            "call me at 555-1234"
        );
        assert_eq!(en("a hundred times"), "a hundred times");
        assert_eq!(en("fifteen thousand users"), "15,000 users");
    }

    #[test]
    fn unknown_language_only_touches_cyrillic() {
        assert_eq!(
            numbers_to_digits("ten slotte twee", None),
            "ten slotte twee"
        );
        assert_eq!(numbers_to_digits("двадцать пятого марта", None), "25 марта");
        assert_eq!(
            numbers_to_digits("il y a vingt", Some("fr")),
            "il y a vingt"
        );
    }

    #[test]
    fn text_without_numbers_is_untouched() {
        let text = "обычный  текст";
        assert_eq!(ru(text), text);
    }
}
