将 `weclaw` fork 构建出来的核心二进制放在这里，并命名为 `weclaw-real`。

产品安装入口 `install.sh` 会把它安装到：

- `~/.weclaw/bin/weclaw-real`

外层 runtime 会再安装一个用户可见的 wrapper：

- `~/.weclaw/bin/weclaw`

这样未来升级时可以分别替换：

- 产品层 runtime
- `weclaw-real` 内核
