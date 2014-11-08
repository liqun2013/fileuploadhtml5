using System;
using System.IO;
using System.Web.Mvc;

namespace UploadFileTest.Controllers
{
	public class FileUploadController : Controller
	{
		private string tempExtension = "_temp";
		private string fileName;
		private string fileType;
		private DateTime lastModifiedTime;
		private long fileSize;
		private long startRange;
		private long endRange;
		private string fileFolder;
		private string fileFullPath;
		private string fileTempFullPath;

		protected string FileFolder
		{
			get
			{
				if (string.IsNullOrWhiteSpace(fileFolder))
				{
					fileFolder = Path.Combine("C:\\uploadedfile", DateTime.Now.ToString("yyyyMM"));
					if (!Directory.Exists(fileFolder))
					{
						Directory.CreateDirectory(fileFolder);
					}
				}

				return fileFolder;
			}
		}

		protected string FileFullPath
		{
			get
			{
				if (string.IsNullOrWhiteSpace(fileFullPath))
				{
					if (!string.IsNullOrWhiteSpace(FileFolder) && !string.IsNullOrWhiteSpace(fileName))
					{
						fileFullPath = Path.Combine(fileFolder, fileName);
					}
				}

				return fileFullPath;
			}
		}

		protected string FileTempFullPath
		{
			get
			{
				if (string.IsNullOrWhiteSpace(fileTempFullPath))
				{
					if (!string.IsNullOrWhiteSpace(FileFullPath))
					{
						fileTempFullPath = FileFullPath + tempExtension;
					}
				}

				return fileTempFullPath;
			}
		}

		public ActionResult UploadFileTest()
		{
			ViewBag.UploadProcessUrl = GetUploadProcessUrl();
			return View();
		}

		[HttpPut]
		public JsonResult ProcessUpload()
		{
			if (this.Request.InputStream.Length == 0)
			{
				return Json(new { Error = "无文件" });
			}

			var headers = this.Request.Headers;

			fileName = headers["Content-FileName"];
			fileType = headers["Content-FileType"];
			var fileLastModified = headers["Content-FileLastModified"];
			var fs = headers["Content-FileSize"];
			var rs = headers["Content-RangeStart"];
			var re = headers["Content-RangeEnd"];

			DateTime.TryParse(fileLastModified, out lastModifiedTime);
			long.TryParse(fs, out fileSize);
			long.TryParse(rs, out startRange);
			long.TryParse(re, out endRange);

			if (startRange == 0)
			{
				try
				{
					if (System.IO.File.Exists(FileFullPath))
					{
						System.IO.File.Delete(FileFullPath);
					}
					else
					{
						if (System.IO.File.Exists(FileTempFullPath))
						{
							using (FileStream f = System.IO.File.Open(FileTempFullPath, FileMode.Open))
							{
								return Json(new { Success = true, UploadedRange = f.Length });
							}
						}
					}
				}
				catch (IOException ioexc)
				{
					return Json(new { Error = ioexc.Message });
				}
			}
			else
			{
				if (!System.IO.File.Exists(FileTempFullPath))
				{
					return Json(new { Success = true, UploadedRange = 0 });
				}
			}

			try
			{
				using (FileStream f = System.IO.File.Open(FileTempFullPath, FileMode.Append))
				{
					SaveFile(this.Request.InputStream, f);
				}

				if (endRange == fileSize)
				{
					System.IO.File.Move(FileTempFullPath, FileFullPath);
				}
			}
			catch (IOException ioExc)
			{
				return Json(new { Error = ioExc.Message });
			}

			return Json(new { Success = true });
		}

		/// <summary>
		/// Save the contents of the Stream to a file
		/// </summary>
		/// <param name="stream"></param>
		/// <param name="f"></param>
		private void SaveFile(Stream stream, FileStream f)
		{
			byte[] buffer = new byte[2048];
			int bytesRead;
			while ((bytesRead = stream.Read(buffer, 0, buffer.Length)) != 0)
			{
				f.Write(buffer, 0, bytesRead);
			}
		}

		private string GetUploadProcessUrl()
		{
			var theUrl = Request.Url;
			return "http://" + theUrl.Host + ((theUrl.Port > 0 && !theUrl.IsDefaultPort) ? (":" + theUrl.Port.ToString()) : string.Empty) + "/FileUpload/ProcessUpload";
		}
	}
}
