import { render } from "@testing-library/react-native";

import { AppIcon } from "@/components/app-icon";

describe("AppIcon", () => {
  it("renders the semantic microphone icon with the shared defaults", async () => {
    const view = await render(<AppIcon name="mic" />);

    expect(view.root).toBeTruthy();
  });

  it("supports explicit size and color for dark surfaces", async () => {
    const view = await render(
      <AppIcon name="volume" size={22} color="#E8FFF6" />,
    );
    if (!view.root) throw new Error("AppIcon did not render a root node");

    expect(view.root.props.height).toBe(22);
    expect(view.root.props.width).toBe(22);
    expect(view.root.props.stroke).toBe("#E8FFF6");
  });

  it("does not expose decorative icons as accessible controls", async () => {
    const view = await render(
      <AppIcon name="sparkles" decorative />,
    );
    if (!view.root) throw new Error("AppIcon did not render a root node");

    expect(view.root.props.accessible).not.toBe(true);
  });
});
