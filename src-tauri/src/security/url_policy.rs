//! URL 白名单策略：仅允许 http、https、mailto 协议的外链。

use url::Url;

/// URL 违反白名单策略时的错误。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct UrlPolicyError;

impl std::fmt::Display for UrlPolicyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("仅支持 http、https、mailto 链接。")
    }
}

impl std::error::Error for UrlPolicyError {}

/// 校验外链协议是否在白名单内（http/https/mailto，大小写不敏感）。
/// 拒绝空串、无法解析的串及一切其他协议（file/javascript/data/vbscript/ftp/自定义协议等）。
pub fn validate_url(url: &str) -> Result<(), UrlPolicyError> {
    let parsed = Url::parse(url).map_err(|_| UrlPolicyError)?;
    // url crate 解析时将协议归一化为小写，故此处比较小写即可覆盖大小写不敏感要求。
    match parsed.scheme() {
        "http" | "https" | "mailto" => Ok(()),
        _ => Err(UrlPolicyError),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_https_url() {
        assert!(validate_url("https://example.com").is_ok());
    }

    #[test]
    fn accepts_http_url_with_path_and_query() {
        assert!(validate_url("http://example.com/a?b=c").is_ok());
    }

    #[test]
    fn accepts_mailto_url() {
        assert!(validate_url("mailto:user@example.com").is_ok());
    }

    #[test]
    fn accepts_uppercase_scheme() {
        assert!(validate_url("HTTPS://EXAMPLE.COM").is_ok());
    }

    #[test]
    fn rejects_file_scheme() {
        assert!(validate_url("file:///tmp/a").is_err());
    }

    #[test]
    fn rejects_javascript_scheme() {
        assert!(validate_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn rejects_data_scheme() {
        assert!(validate_url("data:text/html,x").is_err());
    }

    #[test]
    fn rejects_ftp_scheme() {
        assert!(validate_url("ftp://x").is_err());
    }

    #[test]
    fn rejects_unparseable_input() {
        assert!(validate_url("not-a-url").is_err());
    }

    #[test]
    fn rejects_empty_input() {
        assert!(validate_url("").is_err());
    }

    #[test]
    fn error_message_is_chinese_policy_hint() {
        let err = validate_url("vbscript:msgbox(1)").unwrap_err();
        assert_eq!(err.to_string(), "仅支持 http、https、mailto 链接。");
    }
}
