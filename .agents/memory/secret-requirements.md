# 凭据需求

> 仅记录凭据名称、来源、范围、负责人；绝不记录真实值。

| 名称 | 来源 | 范围 | 负责人 |
|------|------|------|--------|
| `WINDOWS_CERTIFICATE` | GitHub Actions secrets | Windows 签名证书（base64 PFX） | 发布维护者 |
| `WINDOWS_CERTIFICATE_PASSWORD` | GitHub Actions secrets | Windows 签名证书密码 | 发布维护者 |
| `WINDOWS_CERTIFICATE_THUMBPRINT` | GitHub Actions secrets | Windows 证书指纹 | 发布维护者 |
| `APPLE_CERTIFICATE` | GitHub Actions secrets | Apple 签名证书（base64 p12） | 发布维护者 |
| `APPLE_CERTIFICATE_PASSWORD` | GitHub Actions secrets | Apple 证书密码 | 发布维护者 |
| `APPLE_SIGNING_IDENTITY` | GitHub Actions secrets | Apple 签名身份 | 发布维护者 |
| `APPLE_ID` | GitHub Actions secrets | Apple ID（公证） | 发布维护者 |
| `APPLE_PASSWORD` | GitHub Actions secrets | Apple 应用专用密码 | 发布维护者 |
| `APPLE_TEAM_ID` | GitHub Actions secrets | Apple Team ID | 发布维护者 |

## 设置说明

- 仅在 `.github/workflows/release-gate.yml` tag 构建阶段使用；缺失时构建未签名包并在 job summary 中记录。
- 本地开发无需这些凭据。
