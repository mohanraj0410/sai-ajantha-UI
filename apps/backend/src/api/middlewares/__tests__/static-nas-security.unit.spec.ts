import { serveLocalNasFile } from "../../middlewares";

describe("Static / NAS Path Traversal & Asset Security (BE-19)", () => {
  it("rejects path traversal attempts with 403 Forbidden (../)", () => {
    const req: any = {
      method: "GET",
      path: "/static/../../../etc/passwd",
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    serveLocalNasFile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Forbidden asset path." })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects URL-encoded path traversal attempts with 403 Forbidden (%2e%2e)", () => {
    const req: any = {
      method: "GET",
      path: "/static/%2e%2e%2f%2e%2e%2fpackage.json",
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    serveLocalNasFile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Forbidden asset path." })
    );
  });

  it("rejects dotfiles and hidden files with 403 Forbidden", () => {
    const req: any = {
      method: "GET",
      path: "/static/.env",
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    serveLocalNasFile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Forbidden asset path." })
    );
  });

  it("rejects non-allowlisted file extensions (.json, .ts, .sh) with 403 Forbidden", () => {
    const req: any = {
      method: "GET",
      path: "/static/catalog-manifest.json",
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    serveLocalNasFile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Asset extension not permitted." })
    );
  });

  it("rejects null byte injection with 400 Bad Request", () => {
    const req: any = {
      method: "GET",
      path: "/static/product.jpg%00.json",
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    serveLocalNasFile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid static asset path." })
    );
  });
});
