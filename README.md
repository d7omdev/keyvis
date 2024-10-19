# KeyVis

This is a work in progress tool that visualizes keyboard inputs in a GTK window. It is built using the GObject and Gtk libraries in GJS (GNOME JavaScript).

## Features

- Monitors key events and displays them in a window
- Supports visualizing multiple simultaneous key presses
- Automatically hides the window after a configurable timeout

## Installation

### Prerequisites

- GJS (GObject JavaScript) runtime environment
- GTK 4 library
- The `keyd` utility for capturing keyboard events

### Instructions

1. Clone the repository: `git clone https://github.com/d7omdev/keyvis.git`
2. Navigate to the project directory: `cd keyvis`
3. Make the `keyvis` script executable: `chmod +x keyvis`.
4. Run the application: `./keyvis`

<sub>The optional `--debug` flag enables debug mode, which prints additional information to the console.</sub>


## Contributions

Contributions and feedback are welcome! If you encounter any issues or have suggestions for improvements, please [submit an issue](https://github.com/d7omdev/keyvis/issues) or create a pull request.

## License

This project is licensed under the [MIT License](LICENSE).

