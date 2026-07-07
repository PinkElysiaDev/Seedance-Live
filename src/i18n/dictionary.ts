// 中英文字典：仅收录"实用性文本"（提示/错误/说明/副标题）。
// 装饰性大写英文标签（INDEX/RENDERING/INITIATE_RENDER/>> NO_LOG_ENTRIES << 等）不进字典，保持硬编码。
// 变量插值用 {name} 占位，由 i18n store 的 t() 替换。

export type Locale = 'zh' | 'en'

export interface DictEntry {
  zh: string
  en: string
}

export const DICTIONARY: Record<string, DictEntry> = {
  // ===== 语言切换器 =====
  'lang.toggle': { zh: '中', en: 'EN' },
  'lang.rawZh': { zh: '中', en: 'ZH' },
  'lang.rawEn': { zh: '英', en: 'EN' },

  // ===== 校验错误（validate.ts）=====
  'validate.promptEmpty': { zh: '提示词不能为空', en: 'Prompt cannot be empty' },
  'validate.promptTooLong': { zh: '提示词不能超过 {n} 字符', en: 'Prompt cannot exceed {n} characters' },
  'validate.modelResolution': { zh: '{label} 不支持 {res}', en: '{label} does not support {res}' },
  'validate.durationRange': { zh: '时长需在 4–15 秒之间', en: 'Duration must be between 4–15 seconds' },
  'validate.imagesMax': { zh: '参考图最多 {n} 张', en: 'Up to {n} reference images' },
  'validate.videosMax': { zh: '参考视频最多 {n} 个', en: 'Up to {n} reference videos' },
  'validate.audiosMax': { zh: '参考音频最多 {n} 个', en: 'Up to {n} reference audios' },
  'validate.imageSize': { zh: '参考图不能超过 30MB', en: 'Reference image cannot exceed 30MB' },
  'validate.videoSize': { zh: '参考视频不能超过 50MB', en: 'Reference video cannot exceed 50MB' },
  'validate.audioSize': { zh: '参考音频不能超过 15MB', en: 'Reference audio cannot exceed 15MB' },
  'validate.videoDuration': { zh: '参考视频单条时长需在 2–15 秒之间', en: 'Each reference video must be 2–15 seconds' },
  'validate.videoTotalDuration': { zh: '参考视频总时长不能超过 15 秒', en: 'Total reference video duration cannot exceed 15 seconds' },
  'validate.audioTotalDuration': { zh: '参考音频总时长不能超过 15 秒', en: 'Total reference audio duration cannot exceed 15 seconds' },
  'validate.frameMutex': { zh: '首尾帧与参考视频/音频不能同时使用', en: 'First/last frames cannot be used with reference video/audio' },
  'validate.audioNeedsCompanion': { zh: '参考音频需配合参考图或参考视频使用', en: 'Reference audio requires a reference image or video' },

  // ===== Composer toast（Composer.vue）=====
  'toast.promptEmpty': { zh: '请输入提示词', en: 'Please enter a prompt' },
  'toast.apiKeyMissing': { zh: '请先在设置中填写 API Key', en: 'Please fill in the API Key in Settings first' },
  'toast.submitted': { zh: '已提交生成任务', en: 'Generation task submitted' },
  'toast.submitFailed': { zh: '提交失败', en: 'Submission failed' },
  'toast.assetFailed': { zh: '素材 {name} 处理失败', en: 'Failed to process asset {name}' },

  // ===== AssetSlots 素材交互提示 =====
  'toast.assetTypeMismatch': { zh: '{name} 类型不匹配', en: '{name}: type mismatch' },
  'toast.assetRoleMax': { zh: '{role} 已达上限', en: '{role} limit reached' },
  'toast.assetFailedDetailed': { zh: '素材 {name} 处理失败：{msg}', en: 'Failed to process asset {name}: {msg}' },
  'toast.keyframeNotImage': { zh: '{name} 不是图片，已跳过', en: '{name} is not an image, skipped' },
  'title.removeAsset': { zh: '移除', en: 'Remove' },

  // ===== 任务动作 toast（useTaskItem.ts）=====
  'toast.retried': { zh: '已重新提交', en: 'Resubmitted' },
  'toast.chainFailed': { zh: '续帧失败', en: 'Chain failed' },
  'toast.chained': { zh: '已创建续帧任务', en: 'Chain task created' },
  'toast.configLoaded': { zh: '已载入配置到输入区', en: 'Config loaded into the composer' },

  // ===== 设置 toast（SettingsFormContent.vue）=====
  'toast.fillApiKey': { zh: '请先填写 API Key', en: 'Please fill in the API Key first' },
  'toast.testing': { zh: '测试中…', en: 'Testing…' },
  'toast.connSuccess': { zh: '连接成功', en: 'Connection successful' },
  'toast.connAuthed': { zh: '连接成功（鉴权通过）', en: 'Connection successful (authenticated)' },
  'toast.authFailed': { zh: '鉴权失败，请检查 API Key', en: 'Authentication failed, please check the API Key' },
  'toast.connFailed': { zh: '连接失败，详见调试日志', en: 'Connection failed, see debug logs' },
  'toast.enableProxyFirst': { zh: '请先启用代理并填写地址', en: 'Please enable the proxy and fill in its URL first' },
  'toast.proxySaved': { zh: '代理配置已保存，可用「测试连接」验证', en: 'Proxy saved — verify with "Test Connection"' },
  'toast.fillLlmConfig': { zh: '请填全 LLM 配置', en: 'Please complete the LLM config' },
  'toast.llmTesting': { zh: 'LLM 测试中…', en: 'Testing LLM…' },
  'toast.llmConnected': { zh: 'LLM 连通', en: 'LLM connected' },
  'toast.llmFailed': { zh: 'LLM 连接失败，详见调试日志', en: 'LLM connection failed, see debug logs' },
  'toast.aiApplied': { zh: '已应用 AI 解析结果，请检查后保存', en: 'AI parse result applied — please review and save' },
  'toast.tasksCleared': { zh: '已清空任务', en: 'Tasks cleared' },
  'toast.exported': { zh: '已导出', en: 'Exported' },
  'toast.exportFailed': { zh: '导出失败：{msg}', en: 'Export failed: {msg}' },
  'toast.imported': { zh: '已导入 {n} 个任务', en: 'Imported {n} tasks' },
  'toast.importFailed': { zh: '导入失败：{msg}', en: 'Import failed: {msg}' },

  // ===== 设置说明文本（hint/notice）=====
  'hint.verboseLog': { zh: '关闭后仅记录 warn/error 级别日志', en: 'When off, only warn/error logs are recorded' },
  'hint.clearComposer': { zh: '提交后自动清空编辑器内容', en: 'Clear the composer after submitting' },
  'hint.notify': { zh: '任务完成时发送系统通知', en: 'Send a system notification on task completion' },
  'notice.cors': { zh: '官方接口浏览器直连通常会被 CORS 拦截，需自备代理转发。代理脚本示例见 docs/proxy.md。', en: 'Direct browser access to the official API is usually blocked by CORS; provide your own proxy. See docs/proxy.md for an example.' },
  'notice.aiAssist': { zh: '配置大模型 API（OpenAI 兼容），用于在自定义源「AI 解析文档」时自动生成请求模板。支持具有 Vision 能力的模型。', en: 'Configure an OpenAI-compatible LLM to auto-generate request templates via "AI Parse Docs" for custom sources. Vision-capable models are supported.' },
  'notice.exportData': { zh: '导出包含任务、素材、视频与封面，可作为备份或迁移到其他设备。', en: 'Export includes tasks, assets, videos and covers — usable as a backup or for migrating to another device.' },

  // ===== 确认框 =====
  'confirm.clearAllTasks': { zh: '确定清空所有任务历史？此操作不可撤销。', en: 'Clear all task history? This cannot be undone.' },

  // ===== 加载占位 =====
  'placeholder.loading': { zh: '加载中...', en: 'Loading...' },

  // ===== 桌面通知标题 =====
  'notify.title': { zh: '视频生成完成', en: 'Video generation complete' },

  // ===== 任务错误/状态（tasks.ts error 字段，显示在卡片/详情）=====
  'error.noProvider': { zh: '未选择供应商配置', en: 'No provider profile selected' },
  'error.apiKeyMissing': { zh: '请先在设置中填写 API Key', en: 'Please fill in the API Key in Settings first' },
  'error.persistFailed': { zh: '任务持久化失败：{msg}', en: 'Task persistence failed: {msg}' },
  'error.timeout': { zh: '视频生成超时（轮询 {n}s 未完成）', en: 'Video generation timed out (polling {n}s, not finished)' },
  'error.genFailed': { zh: '视频生成{status}', en: 'Video generation {status}' },
  'error.submitInterrupted': { zh: '提交阶段被刷新中断，请重试', en: 'Submission interrupted by a page refresh, please retry' },
  'error.recoverExhausted': { zh: '多次重连失败，请检查网络或代理后重试', en: 'Reconnection failed repeatedly, please check your network or proxy and retry' },
  'error.importedNotResumable': { zh: '导入的任务无法恢复轮询', en: 'Imported task cannot resume polling' },
  'error.noVideoUrl': { zh: '任务成功但未返回视频 URL', en: 'Task succeeded but no video URL returned' },
  'error.continueNoLastFrame': { zh: '源任务未生成末帧，无法续帧', en: 'Source task has no last frame, cannot chain' },
  'error.continueCoverLost': { zh: '末帧数据已丢失', en: 'Last frame data is lost' },
  'error.continueSourceMissing': { zh: '源任务不存在', en: 'Source task does not exist' },

  // ===== 操作日志（tasks.ts log.*，显示在终端页）=====
  'log.submitStarted': { zh: '开始提交任务（{kind}）', en: 'Submitting task ({kind})' },
  'log.stateUpdateFailed': { zh: '状态更新失败：{msg}', en: 'State update failed: {msg}' },
  'log.enqueued': { zh: '任务已入队 remoteTaskId={id}', en: 'Task enqueued, remoteTaskId={id}' },
  'log.submitCancelled': { zh: '提交被取消', en: 'Submission cancelled' },
  'log.submitRecoverable': { zh: '提交遇到可恢复错误：{msg}，将稍后重试', en: 'Recoverable submit error: {msg}, will retry shortly' },
  'log.submitFailed': { zh: '提交失败：{msg}', en: 'Submission failed: {msg}' },
  'log.pollCannotStart': { zh: '无法启动轮询：任务不存在或无 remoteTaskId', en: 'Cannot start polling: task missing or no remoteTaskId' },
  'log.pollStarted': { zh: '开始轮询 remoteTaskId={id}（间隔 {interval}s，上限 {max}s）', en: 'Polling started, remoteTaskId={id} (interval {interval}s, cap {max}s)' },
  'log.pollCancelled': { zh: '轮询被取消', en: 'Polling cancelled' },
  'log.pollTimeout': { zh: '轮询超时（已 {n}s 超过上限 {max}s）', en: 'Polling timed out ({n}s exceeded the {max}s cap)' },
  'log.pollSuccess': { zh: '轮询返回成功，开始下载视频', en: 'Poll returned success, downloading video' },
  'log.pollTerminal': { zh: '轮询返回终态：{status}', en: 'Poll returned terminal state: {status}' },
  'log.pollRunning': { zh: '仍在生成中（已轮询 {n}s）', en: 'Still generating (polled {n}s)' },
  'log.pollRecoverable': { zh: '轮询遇到可恢复错误：{msg}，标记为可恢复', en: 'Recoverable poll error: {msg}, marked recoverable' },
  'log.pollErrorRetry': { zh: '轮询请求出错（将继续重试）：{msg}', en: 'Poll request error (will keep retrying): {msg}' },
  'log.taskRecoverable': { zh: '任务标记为可恢复：{msg}', en: 'Task marked recoverable: {msg}' },
  'log.recoverRetry': { zh: '{delay}s 后重试轮询（第 {attempt}/{max} 次）', en: 'Retrying polling in {delay}s (attempt {attempt}/{max})' },
  'log.recoverExhausted': { zh: '多次重连失败（{n}次），放弃', en: 'Reconnection failed {n} times, giving up' },
  'log.videoDownloaded': { zh: '视频已下载并入库（{n}B）', en: 'Video downloaded and stored ({n}B)' },
  'log.coverFailed': { zh: '封面截图失败（不影响结果）：{msg}', en: 'Cover capture failed (result unaffected): {msg}' },
  'log.videoDownloadFailed': { zh: '视频下载失败（可能 CORS），保留远程 URL 兜底（有时效，请尽快下载）', en: 'Video download failed (likely CORS); kept the remote URL as fallback (time-limited, download soon)' },
  'log.taskCancelled': { zh: '取消任务', en: 'Task cancelled' },
  'log.taskRetry': { zh: '重试任务', en: 'Retrying task' },
  'log.taskRecovered': { zh: '恢复轮询任务 {id}（status={status}, remoteTaskId={remote}）', en: 'Resumed polling task {id} (status={status}, remoteTaskId={remote})' },
  'log.taskInterrupted': { zh: '任务 {id} 在提交阶段被刷新中断（无 remoteTaskId），标记为失败', en: 'Task {id} was interrupted by a refresh during submission (no remoteTaskId), marked as failed' },
  'log.initLoaded': { zh: '初始化：加载 {n} 个任务', en: 'Initialized: loaded {n} tasks' },

  // ===== Provider 日志/错误（customProvider.ts、seedanceProvider.ts）=====
  'error.emptySubmitResponse': { zh: '提交响应为空', en: 'Submission response is empty' },
  'error.noTaskIdInResponse': { zh: '提交响应未包含任务 ID', en: 'Submission response has no task ID' },
  'error.customTemplateMissing': { zh: '自定义接口缺少请求模板', en: 'Custom endpoint is missing a request template' },
  'log.submitVolcano': { zh: '提交火山原生任务 → {url}', en: 'Submitting Volcano native task → {url}' },
  'log.submitCustom': { zh: '提交自定义任务 → {url}', en: 'Submitting custom task → {url}' },
  'log.rawSubmitResponse': { zh: '提交原始响应', en: 'Raw submit response' },
  'log.enqueuedLocal': { zh: '已入队 taskId={id}', en: 'Enqueued, taskId={id}' },
  'log.rawPollResponse': { zh: '轮询原始响应', en: 'Raw poll response' },
  'log.statusExtract': { zh: '状态提取：statusPath="{path}" → raw={raw} → normalized="{status}"', en: 'Status extraction: statusPath="{path}" → raw={raw} → normalized="{status}"' },
  'log.successVideoUrl': { zh: '任务成功 videoUrl={url}', en: 'Task succeeded, videoUrl={url}' },
  'log.taskFailedStatus': { zh: '任务失败 status={status}', en: 'Task failed, status={status}' },
  'log.taskStatus': { zh: '任务{status}', en: 'Task {status}' },
  'log.imagesNotReferenced': { zh: '检测到 {n} 张图片素材，但 body 模板未引用 {{images}}，图片将不会传给 API。请在 body 中添加 "images": {{images}}', en: 'Detected {n} image assets, but the body template does not reference {{images}}; images will not be sent to the API. Add "images": {{images}} to the body.' },

  // ===== httpClient 日志/错误（显示在终端与任务错误卡）=====
  'http.timeout': { zh: '请求超时', en: 'Request timed out' },
  'http.aborted': { zh: '请求已取消', en: 'Request aborted' },
  'http.networkFailed': { zh: '网络请求失败', en: 'Network request failed' },
  'http.logTimeout': { zh: '请求超时 {method} {url}', en: 'Request timed out {method} {url}' },
  'http.logNetworkError': { zh: '网络错误 {method} {url}', en: 'Network error {method} {url}' },
  'http.logResponseBlob': { zh: '响应 {status} (blob {n}B)', en: 'Response {status} (blob {n}B)' },
  'http.logResponse': { zh: '响应 {status}', en: 'Response {status}' },
  'http.notJson': { zh: '响应不是 JSON（content-type: {ct}）', en: 'Response is not JSON (content-type: {ct})' },
  'http.notJsonError': { zh: '响应不是 JSON（可能 URL/鉴权错误，状态 {status}）: {preview}', en: 'Response is not JSON (possibly wrong URL/auth, status {status}): {preview}' },

  // ===== LLM 解析（llmClient.ts）=====
  'error.llmNoContent': { zh: 'LLM 未返回内容', en: 'LLM returned no content' },

  // ===== AI 解析弹窗（AiConfigModal.vue）=====
  'toast.aiConfigLlmFirst': { zh: '请先在「AI 辅助」tab 配置 LLM', en: 'Please configure the LLM in the "AI Assist" tab first' },
  'toast.aiParsed': { zh: '解析完成，请检查后应用', en: 'Parsed — please review and apply' },
  'toast.aiParseFailed': { zh: '解析失败：{msg}', en: 'Parse failed: {msg}' },
  'toast.aiMissingFields': { zh: '解析结果缺少必填字段，请手动补全', en: 'Parsed result is missing required fields — please fill them in' },
  'log.aiParseRequest': { zh: 'AI 解析请求', en: 'AI parse request' },
  'log.aiRawResponse': { zh: 'AI 原始返回', en: 'AI raw response' },
  'log.aiParsedDone': { zh: 'AI 解析完成', en: 'AI parse complete' },
  'log.aiParseFailed': { zh: 'AI 解析失败', en: 'AI parse failed' },
  'notice.aiPasteHint': { zh: '粘贴站点 API 文档内容、上传文档截图，或填文档 URL（经代理抓取）。将调用你在「AI 辅助」配置的大模型生成自定义请求模板。', en: 'Paste the API docs, upload screenshots, or enter a doc URL (fetched via proxy). It calls the LLM configured in "AI Assist" to generate a custom request template.' },
  'notice.aiUrlProxyHint': { zh: '需在「代理」中启用代理才能跨域抓取；失败请改用粘贴内容或截图。', en: 'Enable the proxy in "Proxy" to fetch cross-origin; on failure, paste content or use screenshots instead.' },

  // ===== 默认供应商名（创建时按 locale 取名；用户自定义后不动）=====
  'profile.defaultSeedance': { zh: '火山方舟官方', en: 'Volcano Ark Official' },
  'profile.defaultCustom': { zh: '自定义接口', en: 'Custom Endpoint' },

  // ===== 历史页筛选/标题 =====
  'filter.all': { zh: '全部记录', en: 'All Records' },
  'filter.running': { zh: '生成中', en: 'Generating' },
  'filter.succeeded': { zh: '已完成', en: 'Completed' },
  'filter.failed': { zh: '失败', en: 'Failed' },
  'gallery.videoList': { zh: '视频列表', en: 'Video List' },

  // ===== 工作台/编辑器标签（原装饰大写英文，改为随语言切换）=====
  'wb.currentProvider': { zh: '当前供应商', en: 'Current Provider' },
  'wb.selectProvider': { zh: '选择供应商', en: 'Select Provider' },
  'wb.configureProviders': { zh: '配置供应商', en: 'Configure Providers' },
  'wb.noProvidersConfigured': { zh: '未配置供应商', en: 'No Providers Configured' },
  'wb.renderMode': { zh: '渲染模式', en: 'Render Mode' },
  'wb.modeReference': { zh: '参考图', en: 'Reference' },
  'wb.modeKeyframe': { zh: '首尾帧', en: 'Keyframe' },
  'wb.waitingForData': { zh: '等待数据', en: 'Waiting for Data' },
  // wb.systemStandby 移除：[ System Standby ] 为装饰性英文，硬编码于 WorkbenchView，不随语言切换（item 2）
  'wb.synchronizingCore': { zh: '正在同步核心...', en: 'Synchronizing Core...' },
  'wb.renderComplete': { zh: '渲染完成', en: 'Render Complete' },
  'wb.videoPlayer': { zh: '视频播放器', en: 'Video Player' },
  'wb.mode': { zh: '模式', en: 'Mode' },
  'wb.ratio': { zh: '比例', en: 'Ratio' },
  'wb.res': { zh: '分辨率', en: 'Res' },
  'wb.duration': { zh: '时长', en: 'Duration' },
  'wb.audioGen': { zh: '音频生成', en: 'Audio Gen' },
  'wb.lastFrame': { zh: '末帧', en: 'Last Frame' },
  'wb.watermark': { zh: '水印', en: 'Watermark' },
  'wb.randSeed': { zh: '随机种子', en: 'Rand Seed' },

  // ===== Composer / PromptArea / ParamPanel =====
  'composer.promptInput': { zh: '提示词输入', en: 'Prompt Input' },
  'composer.describeScene': { zh: '描述场景...', en: 'Describe scene...' },
  'composer.systemConflict': { zh: '检测到系统冲突', en: 'System Conflict Detected' },
  'composer.initiateRender': { zh: '开始渲染', en: 'Initiate Render' },
  'param.aspectRatio': { zh: '画面比例', en: 'Aspect Ratio' },
  'param.resolution': { zh: '分辨率', en: 'Resolution' },
  'param.duration': { zh: '时长', en: 'Duration' },
  'param.audioGen': { zh: '音频生成', en: 'Audio Gen' },
  'param.lastFrame': { zh: '末帧', en: 'Last Frame' },
  'param.watermark': { zh: '水印', en: 'Watermark' },
  'param.randSeed': { zh: '随机种子', en: 'Random Seed' },
  'param.seedPlaceholder': { zh: '随机种子', en: 'Rand Seed' },

  // ===== AssetSlots 素材区 =====
  'asset.addReference': { zh: '添加参考素材', en: 'Add Reference' },
  'asset.importHint': { zh: '导入图片 / 视频 / 音频', en: 'Import Image / Video / Audio' },
  'asset.add': { zh: '添加', en: 'Add' },
  'asset.startFrame': { zh: '起始帧', en: 'Start Frame' },
  'asset.endFrame': { zh: '结束帧', en: 'End Frame' },
  'asset.startImage': { zh: '起始图片', en: 'Start Image' },
  'asset.endImage': { zh: '结束图片', en: 'End Image' },

  // ===== 设置页 =====
  // 标题「SYS SETTINGS」、副标题「[Core Config Override]」、四个竖条（PROVIDER/PROXY_NET/AI_ASSIST/GENERAL）
  // 及「CFG //」前缀均为装饰性英文，硬编码于 SettingsView，不随语言切换，故不进字典。
  'settings.back': { zh: '返回', en: 'Back' },

  // ===== 设置-供应商表单 =====
  'form.profileName': { zh: '配置名称', en: 'Profile Name' },
  'form.baseEndpointUrl': { zh: '基础端点 URL', en: 'Base Endpoint URL' },
  'form.authToken': { zh: '授权令牌 (API Key)', en: 'Auth Token (API Key)' },
  'form.modelOverride': { zh: '模型覆盖', en: 'Model Override' },
  'form.addOfficial': { zh: '添加官方', en: 'Add Official' },
  'form.addCustom': { zh: '添加自定义', en: 'Add Custom' },
  'form.officialMode': { zh: '官方渠道', en: 'Official Config' },
  'form.customTemplateMode': { zh: '自定义渠道', en: 'Custom Config' },
  'form.initiateTestSeq': { zh: '测试连接', en: 'Initiate Test Seq' },
  'form.aiParseDocs': { zh: 'AI 解析文档', en: 'AI Parse Docs' },
  'form.submitCfg': { zh: '提交配置', en: 'Submit Config' },
  'form.pollCfg': { zh: '轮询配置', en: 'Poll Config' },
  'form.submitUrl': { zh: '提交 URL', en: 'Submit URL' },
  'form.pollUrl': { zh: '轮询 URL', en: 'Poll URL' },
  'form.httpMethod': { zh: 'HTTP 方法', en: 'HTTP Method' },
  'form.headersPayload': { zh: '请求头', en: 'Headers Payload' },
  'form.addHeader': { zh: '添加请求头', en: 'Add Header' },
  'form.bodyTemplate': { zh: '请求体模板 (JSON 格式)', en: 'Body Template (JSON format)' },
  'form.responsePaths': { zh: '响应提取路径', en: 'Response Extraction Paths' },
  'form.taskIdPath': { zh: '任务 ID 路径', en: 'Task ID Path' },
  'form.statusPath': { zh: '状态路径', en: 'Status Path' },
  'form.successValues': { zh: '成功值 (CSV)', en: 'Success Values (CSV)' },
  'form.failureValues': { zh: '失败值 (CSV)', en: 'Failure Values (CSV)' },
  'form.videoUrlPath': { zh: '视频 URL 路径', en: 'Video URL Path' },
  'form.lastFrameUrlPath': { zh: '末帧 URL 路径', en: 'Last Frame URL Path' },
  'form.errorPath': { zh: '错误路径', en: 'Error Path' },
  'form.progressPath': { zh: '进度路径', en: 'Progress Path' },
  'form.pollIntervalSec': { zh: '轮询间隔 (秒)', en: 'Poll Interval (Sec)' },
  'form.viewVariables': { zh: '查看可用变量', en: 'View Available Variables' },
  'form.deleteHeader': { zh: '删除请求头', en: 'Delete Header' },

  // ===== 设置页四个竖条子标题（标题/前缀为装饰英文，子标题随语言切换，item 1）=====
  'pillar.providerSub': { zh: 'API Key 与端点', en: 'API Key & Endpoint' },
  'pillar.proxySub': { zh: '网络路由', en: 'Network Routing' },
  'pillar.aiSub': { zh: 'LLM 解析引擎', en: 'LLM Parsing Engine' },
  'pillar.generalSub': { zh: '行为与数据', en: 'Behavior & Data' },

  // ===== 设置-代理表单 =====
  'form.enableProxyRouting': { zh: '启用代理路由', en: 'Enable Proxy Routing' },
  'form.proxyEndpointUrl': { zh: '代理端点 URL', en: 'Proxy Endpoint URL' },
  'form.rewriteStrategy': { zh: '改写策略', en: 'Rewrite Strategy' },
  'form.proxyQuery': { zh: '查询参数 (?target=URL)', en: 'Query Param (?target=URL)' },
  'form.proxyPath': { zh: '路径追加 (/URL)', en: 'Path Append (/URL)' },
  'form.applyProxyCfg': { zh: '应用代理配置', en: 'Apply Proxy Cfg' },

  // ===== 设置-AI 辅助表单 =====
  'form.llmBaseUrl': { zh: 'LLM 基础 URL', en: 'LLM Base URL' },
  'form.modelIdVision': { zh: '模型 ID', en: 'Model ID' },
  'form.testLlmLink': { zh: '测试 LLM 连接', en: 'Test LLM Link' },
  'form.verboseLogging': { zh: '详细日志', en: 'Verbose Logging' },

  // ===== 设置-通用 =====
  'form.autoClearInput': { zh: '自动清空输入', en: 'Auto Clear Input' },
  'form.desktopNotify': { zh: '桌面通知', en: 'Desktop Notify' },
  'form.officialPollInterval': { zh: '官方轮询间隔 (秒)', en: 'Official Poll Interval (Sec)' },
  'form.secondsDelay': { zh: '秒延迟', en: 'Seconds Delay' },
  'form.dataManagement': { zh: '数据管理', en: 'Data Management' },
  'form.exportDb': { zh: '导出数据库', en: 'Export DB' },
  'form.importDb': { zh: '导入数据库', en: 'Import DB' },
  'form.purgeAllTasks': { zh: '清空所有任务', en: 'Purge All Tasks' },
  'form.purge': { zh: '清除', en: 'Purge' },

  // ===== AI 解析弹窗（AiConfigModal.vue，三级页面，item 4）=====
  // 标题「✨ AI_PARSE_MODULE //」为装饰性英文，硬编码，不进字典。
  'ai.tabText': { zh: '文本输入', en: 'Text Input' },
  'ai.tabImage': { zh: '图片上传', en: 'Image Upload' },
  'ai.tabUrl': { zh: '文档 URL', en: 'Doc URL' },
  'ai.placeholderPaste': { zh: '>_ 在此粘贴 API 文档…', en: '>_ Paste API documentation here...' },
  'ai.initiateParse': { zh: '立即解析', en: 'Initiate Parse' },
  'ai.processing': { zh: '解析中…', en: 'Processing...' },
  'ai.resultPreview': { zh: '解析结果预览', en: 'Parse Result Preview' },
  'ai.applyToProfile': { zh: '应用到配置', en: 'Apply to Profile' },
  'ai.fieldModel': { zh: '模型', en: 'Model' },
  'ai.fieldSubmitBody': { zh: '请求体', en: 'Submit Body' },
  'ai.fieldNote': { zh: '备注', en: 'Note' },
  // LogPanel
  'log.catAll': { zh: '全部', en: 'All' },
  'log.catSubmit': { zh: '提交', en: 'Submit' },
  'log.catPoll': { zh: '轮询', en: 'Poll' },
  'log.catTask': { zh: '任务', en: 'Task' },
  'log.catTest': { zh: '测试', en: 'Test' },
  'log.catAi': { zh: 'AI', en: 'AI' },
  'log.catSettings': { zh: '设置', en: 'Settings' },
  'log.searchLogs': { zh: '搜索日志…', en: 'SEARCH_LOGS...' },
  'log.clear': { zh: '清除', en: 'CLEAR' },
  'log.copy': { zh: '复制', en: 'COPY' },
  'log.export': { zh: '导出', en: 'EXPORT' },
  'log.noEntries': { zh: '未找到日志条目', en: 'NO_LOG_ENTRIES_FOUND' },
  'log.systemIdle': { zh: '系统空闲 // 等待指令', en: 'SYSTEM_IDLE // AWAITING_COMMAND' },
  'log.expand': { zh: '[+] 展开', en: '[+] EXPAND' },
  'log.collapse': { zh: '[-] 折叠', en: '[-] COLLAPSE' },
  'log.view': { zh: '> 查看', en: '> VIEW' },
}
