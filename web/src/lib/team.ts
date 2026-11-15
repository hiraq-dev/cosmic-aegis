// Edit these in one place. Used in the footer and presentation.
export const TEAM_NAME = "Team AEGIS";
export const REPO_URL = "https://github.com/hiraq-dev/cosmic-aegis";
export const CHALLENGE_URL = "https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/";

export interface SourceItem {
  name: string;
  url: string;
  org: "NASA" | "CSA";
  usedFor: string;
}

// Only resources that this prototype actually draws on. No datasets or APIs are connected.
export const SOURCES: SourceItem[] = [
  {
    name: "5 Hazards of Human Spaceflight (NASA Human Research Program)",
    url: "https://www.nasa.gov/hrp/hazards/",
    org: "NASA",
    usedFor: "Frames the whole prototype: radiation, isolation and confinement, distance from Earth, gravity fields, and hostile closed environments.",
  },
  {
    name: "Risks of Human Spaceflight (NASA Human Research Program)",
    url: "https://www.nasa.gov/hrp/risks/",
    org: "NASA",
    usedFor: "Guides the choice of the three modules: behavioural performance (including sleep), bone and muscle change, and cardiovascular adaptation.",
  },
  {
    name: "Ongoing HRP Research in Space (NASA)",
    url: "https://www.nasa.gov/hrp/ongoing-hrp-research/",
    org: "NASA",
    usedFor: "Background reading on the research behind the indicators. No data is imported from it.",
  },
  {
    name: "Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions (NASA HRP, via NTRS)",
    url: "https://ntrs.nasa.gov/api/citations/20170004604/downloads/20170004604.pdf",
    org: "NASA",
    usedFor: "Supports the idea of crew self-assessment and decision support when ground contact is delayed. Also used by the offline retrieval service in this repository.",
  },
  {
    name: "Evidence Report: Risk of Cardiovascular Disease and Other Degenerative Tissue Effects from Radiation Exposure (NASA HRP, via NTRS)",
    url: "https://ntrs.nasa.gov/api/citations/20150016006/downloads/20150016006.pdf",
    org: "NASA",
    usedFor: "Background for the radiation and cardiovascular indicators. Also used by the offline retrieval service.",
  },
  {
    name: "Monitoring Radiation for Astronaut Health (Canadian Space Agency)",
    url: "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp",
    org: "CSA",
    usedFor: "Background for the simulated radiation indicator on the dashboard.",
  },
  {
    name: "Why Do We Conduct Science Experiments in Space? (Canadian Space Agency)",
    url: "https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp",
    org: "CSA",
    usedFor: "Context for why space-based health research matters. No data is imported from it.",
  },
];
