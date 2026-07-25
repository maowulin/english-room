# English Room Mobile

多人英语实时语音房间 Demo 的 React Native Expo 客户端。

## 开发方式

项目包含后续 TRTC 所需的原生模块边界，因此使用 Expo Development Build，不使用 Expo Go。

```bash
npm install
npm run typecheck
npm run lint
npx expo run:ios
```

只有在原生依赖或应用配置变化后才需要重新构建 Development Build。日常 TypeScript 和样式修改可使用：

```bash
npm start
```
