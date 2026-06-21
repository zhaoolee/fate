use serde::Deserialize;
use serde_json::json;
use std::time::Duration;
use tauri::State;

use crate::shared::SharedTips;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTipsRequest {
    #[serde(default = "default_ai_tip_kind")]
    kind: String,
    base_url: String,
    model: String,
    api_key: String,
    profile: String,
    extra_prompt: Option<String>,
    decor_options: Option<Vec<String>>,
    language: Option<String>,
    current_day: Option<String>,
    status: String,
    period_elapsed_secs: u64,
    idle_secs: u64,
    today_work_secs: u64,
    today_rest_secs: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmTestRequest {
    base_url: String,
    model: String,
    api_key: String,
    profile: String,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Option<Vec<ChatChoice>>,
    error: Option<ChatApiError>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Deserialize)]
struct ChatMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct ChatApiError {
    message: String,
}

fn default_ai_tip_kind() -> String {
    "health".to_string()
}

#[tauri::command]
pub async fn generate_ai_tips(request: AiTipsRequest) -> Result<Vec<String>, String> {
    let (api_key, model) = validate_llm_config(&request.api_key, &request.model)?;
    let endpoint = chat_completions_endpoint(&request.base_url)?;
    let kind = normalize_ai_tip_kind(&request.kind)?;
    let language = normalize_ai_language(request.language.as_deref());
    let spec = ai_tip_spec(kind);
    let hidden_instruction =
        hidden_ai_tip_instruction(kind, request.decor_options.as_deref(), language);
    let text_instruction = text_only_ai_tip_instruction(kind, language);
    let extra_prompt = request.extra_prompt.as_deref().unwrap_or("").trim();
    let current_day = request.current_day.as_deref().unwrap_or("").trim();
    let date_context = if current_day.is_empty() {
        String::new()
    } else {
        format!("当前日期：{}\n", current_day)
    };
    let system_context = if extra_prompt.is_empty() {
        format!("长期记忆 Memory：\n{}", request.profile.trim())
    } else {
        format!(
            "长期记忆 Memory：\n{}\n\n追加 Prompt：\n{}",
            request.profile.trim(),
            extra_prompt
        )
    };
    let output_instruction = if kind == "talisman" && language == "en" {
        "Choose exactly 1 item from the unlocked charm name list in the system prompt. The string must start with the charm name, followed by an English reason, formatted as `摆件名称: English reason`. Return a JSON string array with exactly 1 item, for example [\"文昌塔: Best today as a calm desk reminder.\"]."
    } else if kind == "talisman" {
        "只从系统提示词提供的已解锁摆件名称列表中选择 1 个；必须以摆件名称开头，格式为 `摆件名称：说明文字`。返回值必须是只包含 1 条的 JSON 字符串数组，例如 [\"文昌塔：说明文字\"]。"
    } else if kind == "fortune" && language == "en" {
        "Return a JSON string array with exactly 6 short English daily fortune notes. Cover work, money, relationships, health, and suitable/avoid guidance when possible."
    } else if kind == "fortune" {
        "返回值必须是 JSON 字符串数组；数组必须且只能包含 6 条；每条都是中文今日运势短句，可覆盖事业工作、财运、感情人际、健康、今日宜忌。"
    } else if kind == "health" && language == "en" {
        "Return a JSON string array with exactly 6 short English tips. Each item must be concise, practical, and suitable for direct display."
    } else if kind == "health" {
        "返回值必须是 JSON 字符串数组；数组必须且只能包含 6 条；数组中的每一条都是一个短句，必须不少于 12 个字、不多于 20 个字，数字和标点也算字数。"
    } else {
        "返回值必须是 JSON 字符串数组。"
    };
    let count_instruction = if kind == "talisman" && language == "en" {
        "The array must contain exactly 1 English result and choose only 1 unlocked charm."
    } else if kind == "talisman" {
        "数组必须且只能包含 1 条中文结果，只能选择 1 个已解锁摆件。"
    } else if kind == "fortune" && language == "en" {
        "The array must contain exactly 6 concise English daily fortune notes."
    } else if kind == "fortune" {
        "数组必须且只能包含 6 条中文今日运势简批，每条适合直接展示。"
    } else if kind == "health" && language == "en" {
        "The array must contain exactly 6 English tips. Each item should be direct and display-ready."
    } else if kind == "health" {
        "数组必须且只能包含 6 条中文 tips，每条适合直接展示。"
    } else {
        "数组包含 3 到 5 条中文 tips，每条适合直接展示。"
    };
    let prompt = format!(
        "{}当前状态：{}\n本轮计时：{} 秒\n当前无操作：{} 秒\n今日工作：{} 秒\n今日休息：{} 秒\n\n请把系统提示词中的 Memory 和追加 Prompt 作为背景信息，结合当前日期与当前状态给出「{}」栏目内容。{}\n\n{}",
        date_context,
        request.status,
        request.period_elapsed_secs,
        request.idle_secs,
        request.today_work_secs,
        request.today_rest_secs,
        spec.title,
        spec.user_instruction,
        output_instruction
    );

    let body = json!({
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": format!("你是 Fate 的{}助手。只返回 JSON 字符串数组，不要 markdown，不要解释。{}\n\n{}\n\n{}\n\n{}\n\n{}", spec.title, count_instruction, spec.system_instruction, text_instruction, hidden_instruction, system_context)
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "thinking": { "type": "disabled" },
        "temperature": 0.4,
        "max_tokens": 420,
        "stream": false
    });

    let content = send_chat_completion(endpoint, api_key, body, Duration::from_secs(45)).await?;
    parse_tips_array(&content)
}

#[tauri::command]
pub async fn generate_health_tips(request: AiTipsRequest) -> Result<Vec<String>, String> {
    generate_ai_tips(AiTipsRequest {
        kind: "health".to_string(),
        ..request
    })
    .await
}

#[tauri::command]
pub fn set_health_tips(tips: Vec<String>, health_tips: State<SharedTips>) -> Result<(), String> {
    let tips = clean_tips(tips);
    let mut health_tips = health_tips
        .lock()
        .map_err(|_| "无法更新健康建议 tips".to_string())?;
    *health_tips = tips;
    Ok(())
}

struct AiTipSpec {
    title: &'static str,
    system_instruction: &'static str,
    user_instruction: &'static str,
}

fn normalize_ai_tip_kind(kind: &str) -> Result<&'static str, String> {
    match kind.trim() {
        "" | "health" => Ok("health"),
        "fortune" => Ok("fortune"),
        "talisman" => Ok("talisman"),
        _ => Err("未知 AI 栏目类型".to_string()),
    }
}

fn normalize_ai_language(language: Option<&str>) -> &'static str {
    match language.unwrap_or("").trim() {
        "en" => "en",
        _ => "zh",
    }
}

fn ai_tip_spec(kind: &str) -> AiTipSpec {
    match kind {
        "fortune" => AiTipSpec {
            title: "今日运势",
            system_instruction: "你是克制、专业的今日运势助手。必须优先参考 Memory 中的个人信息、生辰信息，以及追加 Prompt；结合当前日期给出当天倾向性建议。可以使用八字、流年、五行等传统文化语境，但不要做确定性命运预测，不要声称有真实占卜能力，也不要编造用户没有提供的出生信息。",
            user_instruction: "内容要像今日运势简批，不要写成久坐健康提醒。尽量覆盖事业工作、财运、感情人际、健康、今日宜忌等方面；每条给出一个清晰的运势倾向或宜忌建议。",
        },
        "talisman" => AiTipSpec {
            title: "今日最合适的趋吉避凶摆件",
            system_instruction: "从用户已解锁的桌面摆件中选择今天最适合的 1 个。语气可以轻松有趣，但不要声称物品有真实驱邪、治病或改变命运的能力。",
            user_instruction: "只能选择 1 个已解锁摆件；说明文字要落在提醒休息、整理桌面、稳定工作节奏或保持专注上。",
        },
        _ => AiTipSpec {
            title: "健康建议",
            system_instruction: "关注久坐、肩颈、眼睛、补水和休息节奏。只给短动作建议，不要解释原因。不要诊断疾病；如果症状持续或加重，提醒寻求医生帮助。",
            user_instruction: "内容要像极短的健康建议，每条只能给一个能马上执行的休息、活动、远眺、补水或就医提醒。",
        },
    }
}

fn hidden_ai_tip_instruction(
    kind: &str,
    decor_options: Option<&[String]>,
    language: &str,
) -> String {
    if kind != "talisman" {
        return String::new();
    }

    let options = decor_options
        .map(|items| {
            items
                .iter()
                .map(|item| item.trim())
                .filter(|item| !item.is_empty() && !item.contains('/') && !item.contains('\\'))
                .take(80)
                .map(|item| format!("- {item}"))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if options.is_empty() {
        if language == "en" {
            return "The unlocked charm name list is empty. Use `摆件名称: English reason` format."
                .to_string();
        }
        return "已解锁摆件名称列表为空。每条字符串使用 `摆件名称：说明文字` 格式。".to_string();
    }

    if language == "en" {
        format!(
            "Unlocked charm name list (hidden default context; do not repeat the list):\n{}\n\nOutput requirements: choose exactly 1 charm name from the list above, character-for-character; do not invent new names; the returned array must contain exactly 1 string; the string must use `摆件名称: English reason` format; the reason must explain why it fits today's desk rhythm, focusing on rest reminders, desk tidying, steady work rhythm, or focus; do not claim it can change fate, heal illness, or ward off evil.",
            options.join("\n")
        )
    } else {
        format!(
            "已解锁摆件名称列表（这是隐藏默认提示，不需要复述列表）：\n{}\n\n输出要求：只能从上面的列表中逐字选择 1 个摆件名称，不能编造新名称；返回数组必须只有 1 条；字符串必须使用 `摆件名称：说明文字` 格式；说明文字解释为什么今天适合把这个摆件放在桌面上，落点必须是提醒休息、整理桌面、稳定工作节奏或保持专注，不要声称它真的能改变命运、治病或驱邪。",
            options.join("\n")
        )
    }
}

fn text_only_ai_tip_instruction(kind: &str, language: &str) -> &'static str {
    match (kind, language) {
        ("fortune", "en") => {
            "Hard output rules: every array item must be a short English daily fortune note; use the user's memory and birth details if provided; cover work, money, relationships, health, suitable actions, and cautions; do not use titles, numbering, emoji, image names, or charm names; do not make deterministic claims."
        }
        ("fortune", _) => {
            "硬性输出规则：每个数组元素必须是中文今日运势短句；必须优先结合 Memory 中的个性化记忆和生辰信息；不要写成健康动作提醒；不要标题、编号、emoji、图片名或装饰物名称；不要诊断疾病，不要做确定性命运预测；句子风格类似“事业宜先稳后进少做争辩”“财运宜守不宜急投新项”“人际宜柔和表达少逞强”。"
        }
        ("health", "en") => {
            "Hard output rules: every array item must be a short English action tip; keep each item under 12 words; do not use titles, numbering, emoji, image names, or charm names; use direct phrasing such as “Look outside for five minutes” or “Stretch your shoulders before continuing”."
        }
        ("health", _) => {
            "硬性输出规则：每个数组元素必须是一个中文短句；每一条不少于 12 个字、不多于 20 个字，数字和标点也算字数；少于 12 个字或超过 20 个字都是错误；不要标题、编号、emoji、图片名或装饰物名称；不要逗号、分号、破折号后的长解释；句子风格类似“远眺窗外放松眼睛五分钟”“起身活动肩颈缓解僵硬”“整理桌面三分钟再继续”。"
        }
        _ => "",
    }
}

#[tauri::command]
pub async fn test_llm_model(request: LlmTestRequest) -> Result<Vec<String>, String> {
    let (api_key, model) = validate_llm_config(&request.api_key, &request.model)?;
    if request.profile.trim().is_empty() {
        return Err("请先录入 Memory".to_string());
    }
    let endpoint = chat_completions_endpoint(&request.base_url)?;
    let body = json!({
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "你是 Fate 的健康提醒助手。只返回 JSON 字符串数组，不要 markdown，不要解释。数组必须且只能包含 6 条中文健康建议 tips。硬性规则：每个数组元素必须是一个中文短句；每一条不少于 12 个字、不多于 20 个字，数字和标点也算字数；少于 12 个字或超过 20 个字都是错误；不要标题、编号、emoji、图片名或装饰物名称；不要逗号、分号、破折号后的长解释；句子风格类似“远眺窗外放松眼睛五分钟”“起身活动肩颈缓解僵硬”“整理桌面三分钟再继续”。不要诊断疾病；如果症状持续或加重，提醒寻求医生帮助。"
            },
            {
                "role": "user",
                "content": format!("长期记忆 Memory：\n{}\n\n请把 Memory 作为背景信息，给出健康建议 tips。", request.profile.trim())
            }
        ],
        "thinking": { "type": "disabled" },
        "temperature": 0.2,
        "max_tokens": 500,
        "stream": false
    });

    let content = send_chat_completion(endpoint, api_key, body, Duration::from_secs(20)).await?;
    parse_tips_array(&content)
}

fn validate_llm_config<'a>(api_key: &'a str, model: &'a str) -> Result<(&'a str, &'a str), String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("请先填写 API Key".to_string());
    }
    let model = model.trim();
    if model.is_empty() {
        return Err("请填写模型名称".to_string());
    }
    Ok((api_key, model))
}

async fn send_chat_completion(
    endpoint: String,
    api_key: &str,
    body: serde_json::Value,
    timeout: Duration,
) -> Result<String, String> {
    let parsed = send_chat_completion_response(endpoint, api_key, body, timeout).await?;
    let choices = parsed.choices.unwrap_or_default();
    if choices.is_empty() {
        return Err("大模型没有返回 choices".to_string());
    }

    choices
        .into_iter()
        .filter_map(|choice| chat_message_text(choice.message))
        .next()
        .ok_or_else(|| "大模型没有返回可展示内容".to_string())
}

fn chat_message_text(message: ChatMessage) -> Option<String> {
    non_empty_text(message.content)
}

fn non_empty_text(text: Option<String>) -> Option<String> {
    let text = text?;
    let text = text.trim();
    if text.is_empty() {
        None
    } else {
        Some(text.to_string())
    }
}

async fn send_chat_completion_response(
    endpoint: String,
    api_key: &str,
    body: serde_json::Value,
    timeout: Duration,
) -> Result<ChatCompletionResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|error| format!("无法初始化 HTTP 客户端：{error}"))?;

    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("大模型请求失败：{error}"))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("无法读取大模型响应：{error}"))?;

    if !status.is_success() {
        let message = api_error_message(&text);
        return Err(format!(
            "大模型请求失败（{}）：{}",
            status.as_u16(),
            message
        ));
    }

    parse_chat_completion(&text)
}

fn parse_chat_completion(text: &str) -> Result<ChatCompletionResponse, String> {
    let parsed: ChatCompletionResponse =
        serde_json::from_str(text).map_err(|error| format!("无法解析大模型响应：{error}"))?;

    if let Some(error) = parsed.error {
        return Err(error.message);
    }

    Ok(parsed)
}

fn parse_tips_array(content: &str) -> Result<Vec<String>, String> {
    let content = strip_response_fence(content);
    if let Some(tips) = parse_json_tips(&content) {
        let tips = clean_tips(tips);
        if !tips.is_empty() {
            return Ok(tips);
        }
    }

    let tips = parse_plain_tips(&content);
    let tips = clean_tips(tips);
    if tips.is_empty() {
        return Err("大模型没有返回可展示 tips".to_string());
    }
    Ok(tips)
}

fn strip_response_fence(content: &str) -> String {
    content
        .trim()
        .lines()
        .filter(|line| !line.trim_start().starts_with("```"))
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn parse_json_tips(content: &str) -> Option<Vec<String>> {
    let json_text = if content.starts_with('[') || content.starts_with('{') {
        content
    } else if let (Some(start), Some(end)) = (content.find('['), content.rfind(']')) {
        if start <= end {
            &content[start..=end]
        } else {
            return None;
        }
    } else {
        return None;
    };

    let value = serde_json::from_str::<serde_json::Value>(json_text).ok()?;
    Some(tips_value_to_strings(value))
}

fn tips_value_to_strings(value: serde_json::Value) -> Vec<String> {
    match value {
        serde_json::Value::Array(values) => values
            .into_iter()
            .filter_map(tip_value_to_string)
            .collect::<Vec<_>>(),
        serde_json::Value::Object(object) => {
            for key in ["tips", "items", "suggestions", "data", "result"] {
                if let Some(value) = object.get(key).cloned() {
                    let tips = tips_value_to_strings(value);
                    if !tips.is_empty() {
                        return tips;
                    }
                }
            }
            tip_value_to_string(serde_json::Value::Object(object))
                .into_iter()
                .collect()
        }
        value => tip_value_to_string(value).into_iter().collect(),
    }
}

fn tip_value_to_string(value: serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(text) => Some(text),
        serde_json::Value::Object(object) => {
            let name = object
                .get("image")
                .or_else(|| object.get("imageName"))
                .or_else(|| object.get("image_name"))
                .or_else(|| object.get("name"))
                .or_else(|| object.get("file"))
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .trim();
            let description = object
                .get("description")
                .or_else(|| object.get("text"))
                .or_else(|| object.get("reason"))
                .or_else(|| object.get("tip"))
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .trim();

            if name.is_empty() && description.is_empty() {
                None
            } else if name.is_empty() {
                Some(description.to_string())
            } else if description.is_empty() {
                Some(name.to_string())
            } else {
                Some(format!("{name}：{description}"))
            }
        }
        _ => None,
    }
}

fn parse_plain_tips(content: &str) -> Vec<String> {
    let line_tips = content
        .lines()
        .map(clean_tip_text)
        .filter(|tip| !tip.is_empty())
        .collect::<Vec<_>>();

    if line_tips.len() > 1 {
        return line_tips;
    }

    content
        .split('。')
        .map(clean_tip_text)
        .filter(|tip| !tip.is_empty())
        .map(|tip| format!("{tip}。"))
        .collect()
}

fn clean_tips(tips: Vec<String>) -> Vec<String> {
    tips.into_iter()
        .map(clean_tip_text)
        .filter(|tip| !tip.is_empty())
        .collect()
}

fn clean_tip_text(tip: impl AsRef<str>) -> String {
    let mut text = tip
        .as_ref()
        .trim()
        .trim_matches(|ch| matches!(ch, '"' | '\'' | '`' | ',' | '，' | '[' | ']'))
        .replace("**", "");

    loop {
        let trimmed = text.trim_start();
        let next = trimmed
            .strip_prefix('-')
            .or_else(|| trimmed.strip_prefix('*'))
            .or_else(|| trimmed.strip_prefix('•'))
            .or_else(|| trimmed.strip_prefix('、'))
            .map(str::trim_start);

        if let Some(next) = next {
            text = next.to_string();
            continue;
        }

        let digit_count = trimmed
            .chars()
            .take_while(|ch| ch.is_ascii_digit())
            .map(char::len_utf8)
            .sum::<usize>();

        if digit_count > 0 {
            let rest = &trimmed[digit_count..];
            let rest = rest
                .strip_prefix('.')
                .or_else(|| rest.strip_prefix(')'))
                .or_else(|| rest.strip_prefix('、'))
                .or_else(|| rest.strip_prefix('．'));
            if let Some(rest) = rest {
                text = rest.trim_start().to_string();
                continue;
            }
        }

        return trimmed.trim().to_string();
    }
}

fn chat_completions_endpoint(base_url: &str) -> Result<String, String> {
    let base_url = base_url.trim().trim_end_matches('/');
    if base_url.is_empty() {
        return Err("请填写 Base URL".to_string());
    }
    if !base_url.starts_with("https://") && !base_url.starts_with("http://") {
        return Err("Base URL 需要以 http:// 或 https:// 开头".to_string());
    }
    if base_url.ends_with("/chat/completions") {
        Ok(base_url.to_string())
    } else {
        Ok(format!("{base_url}/chat/completions"))
    }
}

fn api_error_message(text: &str) -> String {
    serde_json::from_str::<ChatCompletionResponse>(text)
        .ok()
        .and_then(|response| response.error.map(|error| error.message))
        .filter(|message| !message.trim().is_empty())
        .unwrap_or_else(|| text.chars().take(400).collect())
}
