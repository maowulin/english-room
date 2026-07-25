# English Room Demo

一个面向候选人实作题的多人英语实时语音房间 Demo。

项目使用 React Native Expo 构建客户端，并使用 Python FastAPI 提供后端 API。

## 当前目标

- 支持多名玩家进入同一房间并保持成员状态一致。
- 使用腾讯云实时音视频（TRTC）实现实时语音。
- 在房间结束后处理玩家英语语音并生成口语评分。
- 正确关联玩家、音频、评分任务和最终结果。
- 展示等待、处理中、成功和失败等关键状态。

## 已确认的技术选择

- 客户端：React Native Expo
- 客户端运行方式：Expo Development Build
- 后端：Python FastAPI
- 实时音频：腾讯云 TRTC
- 口语评分：腾讯云口语评测（新版）

## 文档

- [架构讨论记录](./docs/discussions/2026-07-25-architecture-notes.md)
- [需求解读](./docs/requirements/assessment-brief.md)
- [基础框架架构](./docs/architecture/foundation.md)
- [原始题目副本说明](./docs/source/README.md)

## 项目状态

当前正在搭建可运行的基础框架。
