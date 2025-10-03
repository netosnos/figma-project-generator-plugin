// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, { width: 420, height: 580 });

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
type GeneratePayload = {
  title: string;
  designer: string;
  tpm: string;
  area: string;
  type?: string;
  context: string;
};

// Component keys will be loaded from config.json
let COVER_COMPONENT_KEYS: Record<string, string> = {};
let TEAM_COMPONENT_KEYS: Record<string, string> = {};
let CONTEXT_COMPONENT_KEYS: Record<string, string> = {};

// Load configuration from config.json
async function loadConfig() {
  try {
    const configResponse = await fetch("./config.json");
    const config = await configResponse.json();

    COVER_COMPONENT_KEYS = config.componentKeys.cover;
    TEAM_COMPONENT_KEYS = config.componentKeys.team;
    CONTEXT_COMPONENT_KEYS = config.componentKeys.context;

    console.log("Configuration loaded successfully");
    console.log("Cover keys:", COVER_COMPONENT_KEYS);
    console.log("Team keys:", TEAM_COMPONENT_KEYS);
    console.log("Context keys:", CONTEXT_COMPONENT_KEYS);
  } catch (error) {
    console.error("Error loading config:", error);
    // Fallback to hardcoded values
    COVER_COMPONENT_KEYS = {
      MY: "a123290810f6f2bd60455ebeb129b9487b36aaeb",
      PRO: "98eb7f7153fee359d82ea68def98be045fb06ced",
    };
    TEAM_COMPONENT_KEYS = {
      MY: "f6d3f31bcca61d2a122038f93fd442352d9537c9",
      PRO: "5a498db92f8b29b143b61ec892695ec43fc05f2a",
    };
    CONTEXT_COMPONENT_KEYS = {
      MY: "e467a8aa279dfc2e637b2c93345d0fde1140946e",
      PRO: "f79cf58bd50bc68ea57a1b32d6c3f00af19f4bcd",
    };
  }
}

// Load config when plugin starts
loadConfig();

function checkIfProjectExists() {
  const mainPages = [
    "📙 About",
    "🟢 Ready for Development",
    "🔵 For Review",
    "🚧 WIP",
    "🕵️ User Tests",
    "📁 Archive",
  ];

  for (const pageName of mainPages) {
    const existingPage = figma.root.children.find(
      (page) => page.name === pageName
    );
    if (existingPage) {
      return true;
    }
  }
  return false;
}

function createPageStructure() {
  const pages = [
    "📙 About",
    "---",
    "🟢 Ready for Development",
    "---",
    "🔵 For Review",
    "---",
    "🚧 WIP",
    "    Start - " +
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    "---",
    "🕵️ User Tests",
    "---",
    "📁 Archive",
  ];

  const createdPages = [];

  for (const pageName of pages) {
    // Create new page
    const newPage = figma.createPage();
    newPage.name = pageName;
    figma.root.appendChild(newPage);
    createdPages.push(newPage);
  }

  return createdPages;
}

figma.ui.onmessage = async (msg: {
  type: string;
  count?: number;
  payload?: GeneratePayload;
}) => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg.type === "generate-project") {
    const data = msg.payload;
    if (!data) {
      figma.ui.postMessage({ type: "error", text: "Datos no recibidos." });
      return;
    }

    const { title, designer, tpm, area, type, context } = data;
    const componentKey = COVER_COMPONENT_KEYS[area];
    if (!componentKey) {
      figma.ui.postMessage({
        type: "error",
        text: `No component key for area ${area}.`,
      });
      return;
    }

    if (!type) {
      figma.ui.postMessage({
        type: "error",
        text: "Type is required.",
      });
      return;
    }

    try {
      // Check if project already exists
      if (checkIfProjectExists()) {
        figma.notify(
          "El proyecto ya está creado. Las páginas principales ya existen en este archivo.",
          { error: true }
        );

        // Send error message to UI to restore button
        figma.ui.postMessage({
          type: "error",
          text: "Proyecto ya existe",
        });
        return;
      }

      // Show single progress notification
      figma.notify("Generando proyecto...");

      // Note: Background color will be set at the end to avoid being overwritten

      // Store the initial page to delete it later
      const initialPage = figma.currentPage;

      // Create page structure
      const createdPages = createPageStructure();

      // Find the About page (should be the first one created)
      const aboutPage = figma.root.children.find(
        (page) => page.name === "📙 About"
      );

      if (!aboutPage) {
        figma.notify("Error: No se pudo encontrar la página About.", {
          error: true,
        });

        // Send error message to UI to restore button
        figma.ui.postMessage({
          type: "error",
          text: "Error al encontrar página",
        });
        return;
      }

      // Switch to About page
      await figma.setCurrentPageAsync(aboutPage as PageNode);

      // Delete the initial page after creating the structure
      if (initialPage && initialPage.name !== "📙 About") {
        initialPage.remove();
      }

      // Generate cover
      const coverComp = await figma.importComponentByKeyAsync(componentKey);
      const coverInstance = coverComp.createInstance();

      // Set variant properties
      coverInstance.setProperties({ Type: type });

      // Find text layers by name
      const titleLayer = coverInstance.findOne(
        (node) => node.name === "Title" && node.type === "TEXT"
      ) as TextNode;
      const designerLayer = coverInstance.findOne(
        (node) => node.name === "Designer" && node.type === "TEXT"
      ) as TextNode;

      // Load fonts and set text content
      if (titleLayer) {
        await figma.loadFontAsync(titleLayer.fontName as FontName);
        titleLayer.characters = title;
      }

      if (designerLayer) {
        await figma.loadFontAsync(designerLayer.fontName as FontName);
        // Extract only the name part (before " - ") for the cover
        const designerName = designer.split(" - ")[0];
        designerLayer.characters = `Designer: ${designerName}`;
      }

      coverInstance.x = figma.viewport.center.x;
      coverInstance.y = figma.viewport.center.y;
      figma.currentPage.appendChild(coverInstance);

      // Generate team frame
      const teamComponentKey = TEAM_COMPONENT_KEYS[area];
      if (
        teamComponentKey &&
        teamComponentKey !== "PLACEHOLDER_MY_TEAM_KEY" &&
        teamComponentKey !== "PLACEHOLDER_PRO_TEAM_KEY"
      ) {
        const teamComp = await figma.importComponentByKeyAsync(
          teamComponentKey
        );
        const teamInstance = teamComp.createInstance();

        // Set variant properties
        teamInstance.setProperties({ Type: type });

        // Find team text layers
        const tpmNameLayer = teamInstance.findOne(
          (node) => node.name === "TPM Full Name" && node.type === "TEXT"
        ) as TextNode;
        const tpmEmailLayer = teamInstance.findOne(
          (node) => node.name === "TPM Email" && node.type === "TEXT"
        ) as TextNode;
        const designerNameLayer = teamInstance.findOne(
          (node) => node.name === "Designer Full Name" && node.type === "TEXT"
        ) as TextNode;
        const designerEmailLayer = teamInstance.findOne(
          (node) => node.name === "Designer Email" && node.type === "TEXT"
        ) as TextNode;

        // Set team content
        if (tpmNameLayer) {
          await figma.loadFontAsync(tpmNameLayer.fontName as FontName);
          tpmNameLayer.characters = tpm.split(" - ")[0]; // Extract name from "Name - email"
        }
        if (tpmEmailLayer) {
          await figma.loadFontAsync(tpmEmailLayer.fontName as FontName);
          tpmEmailLayer.characters = tpm.split(" - ")[1] || ""; // Extract email
        }
        if (designerNameLayer) {
          await figma.loadFontAsync(designerNameLayer.fontName as FontName);
          designerNameLayer.characters = designer.split(" - ")[0]; // Extract name from "Name - email"
        }
        if (designerEmailLayer) {
          await figma.loadFontAsync(designerEmailLayer.fontName as FontName);
          designerEmailLayer.characters = designer.split(" - ")[1] || ""; // Extract email
        }

        // Position team frame to the right of cover
        teamInstance.x = coverInstance.x + coverInstance.width + 100;
        teamInstance.y = coverInstance.y;
        figma.currentPage.appendChild(teamInstance);
      }

      // Generate context frame
      const contextComponentKey = CONTEXT_COMPONENT_KEYS[area];
      console.log(
        "Context component key for area",
        area,
        ":",
        contextComponentKey
      );
      console.log("All context keys:", CONTEXT_COMPONENT_KEYS);

      if (
        contextComponentKey &&
        contextComponentKey !== "PLACEHOLDER_MY_CONTEXT_KEY" &&
        contextComponentKey !== "PLACEHOLDER_PRO_CONTEXT_KEY"
      ) {
        try {
          console.log(
            "Generating context frame with key:",
            contextComponentKey
          );
          const contextComp = await figma.importComponentByKeyAsync(
            contextComponentKey
          );
          const contextInstance = contextComp.createInstance();

          // Try to set properties, but don't fail if it doesn't work
          try {
            contextInstance.setProperties({ Type: type });
          } catch (propError) {
            console.warn("Could not set context properties:", propError);
          }

          // Debug: Log all text nodes in the context instance
          console.log("Searching for context text layer...");
          const allTextNodes = contextInstance.findAll(
            (node) => node.type === "TEXT"
          );
          console.log("Found text nodes:", allTextNodes.length);
          allTextNodes.forEach((node, index) => {
            console.log(`Text node ${index}:`, {
              name: node.name,
              characters: (node as TextNode).characters,
              type: node.type,
            });
          });

          // Find context text layer - try different possible names
          let contextLayer = contextInstance.findOne(
            (node) => node.name === "Context" && node.type === "TEXT"
          ) as TextNode;
          console.log("Found by name 'Context':", contextLayer ? "YES" : "NO");

          // If not found by name "Context", try to find by content "[Context]"
          if (!contextLayer) {
            contextLayer = contextInstance.findOne(
              (node) =>
                node.type === "TEXT" && node.characters.includes("[Context]")
            ) as TextNode;
            console.log(
              "Found by content '[Context]':",
              contextLayer ? "YES" : "NO"
            );
          }

          // If still not found, try to find any text node
          if (!contextLayer) {
            contextLayer = contextInstance.findOne(
              (node) => node.type === "TEXT"
            ) as TextNode;
            console.log("Found any text node:", contextLayer ? "YES" : "NO");
          }

          if (contextLayer) {
            console.log(
              "Before update - Current text:",
              contextLayer.characters
            );
            await figma.loadFontAsync(contextLayer.fontName as FontName);
            contextLayer.characters = context;
            console.log("After update - New text:", contextLayer.characters);
            console.log("Context text updated successfully:", context);
          } else {
            console.warn("Context text layer not found");
          }

          // Position context frame to the right of team frame
          contextInstance.x = coverInstance.x + (coverInstance.width + 100) * 2;
          contextInstance.y = coverInstance.y;
          figma.currentPage.appendChild(contextInstance);
          console.log("Context frame created successfully");
        } catch (contextError) {
          console.error("Error creating context frame:", contextError);
          // Don't fail the entire process if context fails
        }
      } else {
        console.log(
          "Context component key not found or is placeholder for area:",
          area
        );
        console.log("Available context keys:", CONTEXT_COMPONENT_KEYS);
      }

      // Detach instance of cover and set as file thumbnail
      if (coverInstance.type === "INSTANCE") {
        const detachedCover = coverInstance.detachInstance();
        // Set the detached cover as the file thumbnail
        await figma.setFileThumbnailNodeAsync(detachedCover);
        console.log("Cover instance detached and set as file thumbnail");
      }

      figma.viewport.scrollAndZoomIntoView([coverInstance]);

      // Set background color of all pages to #F5F5F5 (at the end to avoid being overwritten)
      console.log("Setting background color of all pages to #F5F5F5...");
      figma.root.children.forEach((page, index) => {
        if (page.type === "PAGE") {
          console.log(`Setting background for page ${index}: ${page.name}`);
          try {
            page.backgrounds = [
              { type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } },
            ];
            console.log(`Background set for page: ${page.name}`);
          } catch (error) {
            console.error(
              `Error setting background for page ${page.name}:`,
              error
            );
          }
        }
      });
      console.log("Background color change completed");

      // Clear any previous notifications and show success
      figma.notify(`✅ Proyecto "${title}" generado exitosamente!`, {
        timeout: 3000,
      });

      // Send success message to UI to restore button
      figma.ui.postMessage({
        type: "success",
        text: "Proyecto generado exitosamente",
      });
    } catch (err) {
      console.error("Generation error:", err);
      figma.notify(
        `❌ Error al generar: ${
          err instanceof Error ? err.message : "Error desconocido"
        }`,
        { error: true, timeout: 4000 }
      );

      // Send error message to UI to restore button
      figma.ui.postMessage({
        type: "error",
        text: "Error al generar proyecto",
      });
    }
    return;
  }

  if (msg.type === "instantiate-cover") {
    const data = msg.payload as { area?: string; type?: string } | undefined;
    const area = data?.area === "PRO" ? "PRO" : "MY";
    const type = data?.type || "Shopping";
    const key = COVER_COMPONENT_KEYS[area];
    if (!key) {
      figma.ui.postMessage({
        type: "error",
        text: `No component key for area ${area}.`,
      });
      return;
    }

    try {
      const comp = await figma.importComponentByKeyAsync(key);
      const instance = comp.createInstance();

      // Set variant properties
      instance.setProperties({ Type: type });

      // Find text layers by name
      const titleLayer = instance.findOne(
        (node) => node.name === "Title" && node.type === "TEXT"
      ) as TextNode;
      const designerLayer = instance.findOne(
        (node) => node.name === "Designer" && node.type === "TEXT"
      ) as TextNode;

      // Load fonts and set text content
      if (titleLayer) {
        await figma.loadFontAsync(titleLayer.fontName as FontName);
        titleLayer.characters = "Sample Project Title";
      }

      if (designerLayer) {
        await figma.loadFontAsync(designerLayer.fontName as FontName);
        designerLayer.characters = "Designer: Sample Designer";
      }

      instance.x = figma.viewport.center.x;
      instance.y = figma.viewport.center.y;
      figma.currentPage.appendChild(instance);
      figma.viewport.scrollAndZoomIntoView([instance]);
      figma.ui.postMessage({
        type: "status",
        text: `Instantiated ${area} cover with Type: ${type}`,
      });
    } catch (_err) {
      figma.ui.postMessage({
        type: "error",
        text: "Failed to import/instantiate component.",
      });
    }
    return;
  }

  if (msg.type === "get-keys") {
    const sel = figma.currentPage.selection[0];
    if (!sel) {
      figma.ui.postMessage({
        type: "error",
        text: "Select an instance or component.",
      });
      return;
    }

    let componentKey: string | undefined;
    let componentSetKey: string | undefined;
    const name: string | undefined = sel.name;

    try {
      if (sel.type === "INSTANCE") {
        const mainComp = await sel.getMainComponentAsync();
        if (mainComp) {
          componentKey = mainComp.key;
          if (mainComp.parent && mainComp.parent.type === "COMPONENT_SET") {
            componentSetKey = mainComp.parent.key;
          }
        }
      } else if (sel.type === "COMPONENT") {
        componentKey = sel.key;
        if (sel.parent && sel.parent.type === "COMPONENT_SET") {
          componentSetKey = sel.parent.key;
        }
      } else if (sel.type === "COMPONENT_SET") {
        componentSetKey = sel.key;
      }
    } catch (_err) {
      figma.ui.postMessage({
        type: "error",
        text: "Failed to read component keys.",
      });
      return;
    }

    if (!componentKey && !componentSetKey) {
      figma.ui.postMessage({
        type: "error",
        text: "Selection has no component keys.",
      });
      return;
    }

    figma.ui.postMessage({
      type: "keys-result",
      componentKey,
      componentSetKey,
      name,
    });
    return;
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  if (msg.type === "cancel") {
    figma.closePlugin();
  }
};
