import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { LaunchLoadingOverlay } from "@/components/launch-loading-overlay";

describe("LaunchLoadingOverlay", () => {
  it("shows the branded loading copy while visible", async () => {
    const view = await render(<LaunchLoadingOverlay visible />);

    view.getByText("A room for your voice");
    view.getByText("English Room");
    view.getByText("Preparing your room");
  });

  it("renders no loading content when hidden", async () => {
    const view = await render(<LaunchLoadingOverlay visible={false} />);

    expect(view.queryByText("Preparing your room")).toBeNull();
  });

  it("exposes a non-interactive accessible brand surface", async () => {
    const view = await render(<LaunchLoadingOverlay visible />);
    const brand = view.getByLabelText("English Room");

    expect(brand.props.accessible).toBe(true);
    expect(StyleSheet.flatten(brand.props.style).pointerEvents).toBe("none");
  });
});
