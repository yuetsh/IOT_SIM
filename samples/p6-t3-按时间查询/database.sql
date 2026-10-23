-- 实验的初始数据库：任务 1 建的"环境数据表"库和 EnvironmentWork 表，任务 2 第 1 步建的 CampusEnvironment 表。
-- 学生可以在数据库页面"恢复实验初始数据"；评分时每个检查项用一份新的。
CREATE DATABASE 环境数据表
GO
USE 环境数据表
GO
CREATE TABLE EnvironmentWork (light varchar(MAX) NULL, temperature varchar(MAX) NULL, humidity varchar(MAX) NULL)
CREATE TABLE CampusEnvironment (ID int IDENTITY(1,1) PRIMARY KEY, light varchar(50), humidity varchar(50), temperature varchar(50), addtime datetime)
GO
INSERT INTO EnvironmentWork VALUES ('520', '24', '58')
INSERT INTO EnvironmentWork VALUES ('480', '25', '61')
INSERT INTO CampusEnvironment (light, humidity, temperature, addtime) VALUES ('520', '58', '24', '2024-01-16 09:00:00')
INSERT INTO CampusEnvironment (light, humidity, temperature, addtime) VALUES ('610', '55', '26', '2024-01-18 14:30:00')
INSERT INTO CampusEnvironment (light, humidity, temperature, addtime) VALUES ('300', '63', '21', '2024-01-23 08:15:00')
