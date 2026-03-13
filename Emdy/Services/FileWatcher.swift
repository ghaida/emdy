import Foundation

enum FileChangeEvent {
    case modified
    case deleted
}

final class FileWatcher {
    private var source: DispatchSourceFileSystemObject?
    private let fileDescriptor: Int32
    private let onChange: (FileChangeEvent) -> Void

    init?(url: URL, onChange: @escaping (FileChangeEvent) -> Void) {
        self.onChange = onChange
        let fd = open(url.path, O_EVTONLY)
        guard fd >= 0 else { return nil }
        self.fileDescriptor = fd

        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fd,
            eventMask: [.write, .delete, .rename],
            queue: .main
        )

        source.setEventHandler { [weak self] in
            guard let self, let source = self.source else { return }
            let flags = source.data
            if flags.contains(.delete) || flags.contains(.rename) {
                self.onChange(.deleted)
            } else {
                self.onChange(.modified)
            }
        }

        source.setCancelHandler {
            close(fd)
        }

        self.source = source
        source.resume()
    }

    deinit {
        source?.cancel()
    }
}
